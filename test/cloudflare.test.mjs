import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { backendRoute, createWorker } from '../cloudflare/worker.js'

const publicOrigin = 'https://6ixsummitlabs.com'
const origin = 'https://sixthsummitlabs-production.up.railway.app'
const env = { BACKEND_ORIGIN: origin, ASSETS: { fetch: async () => new Response('<html>website</html>') } }

test('Cloudflare keeps staff and gallery pages separate from native CRM and prospect APIs', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.json', import.meta.url)))
  assert.equal(config.name, 'sixthsummitlabs')
  assert.equal(config.vars.BACKEND_ORIGIN, origin)
  assert.equal(config.assets.directory, './dist')
  for (const prefix of ['crm', 'designs', 'prospect-api']) {
    assert.ok(config.assets.run_worker_first.includes(`/${prefix}`))
    assert.ok(config.assets.run_worker_first.includes(`/${prefix}/*`))
  }
  const worker = createWorker(() => assert.fail('Frontend route reached Railway'))
  for (const path of ['/', '/crm', '/crm/', '/crm/leads', '/crm/leads/9', '/crm/login', '/crm/analytics', '/crm/designs', '/crm/follow-ups', '/designs/token', '/assets/index.js']) {
    assert.equal(backendRoute(path), false, path)
    const response = await worker.fetch(new Request(publicOrigin + path), env)
    assert.match(await response.text(), /website/)
    if (path.startsWith('/crm') || path.startsWith('/designs')) {
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer')
    } else assert.equal(response.headers.get('Cache-Control'), null)
  }
  for (const path of ['/crm/api/auth:signIn', '/crm/api/auth%3AsignIn', '/crm/admin/sixsummit', '/crm/v/', '/crm/assets/a.js', '/crm/static/plugins/a.js', '/crm/ws', '/crm/leads-other', '/prospect-api', '/prospect-api/staff/a.png', '/prospect-api/designs/token']) {
    assert.equal(backendRoute(path), true, path)
  }
})

test('proxy preserves request bodies, encoded queries, sessions and roles and replaces forwarding headers', async () => {
  const path = '/crm/api/six_crm:update?filter=%7B%22a%22%3A%22A%26B%22%7D'
  const worker = createWorker(async (request, options) => {
    assert.equal(request.url, origin + path)
    assert.equal(request.method, 'POST')
    assert.equal(await request.text(), '{"note":"test"}')
    for (const [key, value] of Object.entries({ Authorization: 'Bearer test-token', 'X-Role': 'sixsummit_caller', 'X-Authenticator': 'basic', Cookie: 'test-session=value', Origin: publicOrigin })) assert.equal(request.headers.get(key), value)
    assert.equal(request.headers.get('Host'), new URL(origin).host)
    assert.equal(request.headers.get('X-Forwarded-Host'), '6ixsummitlabs.com')
    assert.equal(request.headers.get('X-Forwarded-Proto'), 'https')
    assert.equal(request.headers.get('X-Forwarded-For'), '203.0.113.20')
    assert.equal(request.headers.get('Forwarded'), null)
    assert.equal(request.headers.get('X-Forwarded-Port'), null)
    assert.equal(options.redirect, 'manual')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.cf.cacheTtlByStatus['100-599'], -1)
    return Response.json({ ok: true })
  })
  const response = await worker.fetch(new Request(publicOrigin + path, {
    method: 'POST', body: '{"note":"test"}', headers: {
      Authorization: 'Bearer test-token', 'X-Role': 'sixsummit_caller', 'X-Authenticator': 'basic',
      Cookie: 'test-session=value', Origin: publicOrigin, 'CF-Connecting-IP': '203.0.113.20',
      'X-Forwarded-For': 'spoofed', 'X-Forwarded-Host': 'spoofed',
      Forwarded: 'host=spoofed', 'X-Forwarded-Port': '9999',
    },
  }), env)
  assert.equal(response.status, 200)
})

test('private files retain their bytes, status, CSP, cookie attributes and range headers without caching', async () => {
  const bytes = new Uint8Array([0, 255, 137, 80, 78, 71])
  const worker = createWorker(async () => new Response(bytes, { status: 206, headers: {
    'Content-Type': 'image/png', 'Content-Range': 'bytes 0-5/10',
    'Content-Security-Policy': "sandbox; default-src 'none'", 'Cache-Control': 'public, max-age=3600',
    'CDN-Cache-Control': 'public', 'Cloudflare-CDN-Cache-Control': 'public',
    'Set-Cookie': 'test=value; Path=/crm; HttpOnly; Secure; SameSite=Strict',
  } }))
  const response = await worker.fetch(new Request(publicOrigin + '/prospect-api/staff/preview.png'), env)
  assert.equal(response.status, 206)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
  assert.equal(response.headers.get('Content-Security-Policy'), "sandbox; default-src 'none'")
  assert.equal(response.headers.get('Content-Range'), 'bytes 0-5/10')
  assert.match(response.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Strict/)
  for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control']) assert.equal(response.headers.get(header), 'no-store')
})

test('redirects are never followed with credentials and Railway redirects stay on the public origin', async () => {
  for (const [location, expected] of [
    [origin + '/crm/admin?tab=one#view', publicOrigin + '/crm/admin?tab=one#view'],
    ['/crm/admin', publicOrigin + '/crm/admin'],
    ['https://external.example/sign-in', 'https://external.example/sign-in'],
  ]) {
    let calls = 0
    const worker = createWorker(async (request, options) => {
      calls++
      assert.equal(options.redirect, 'manual')
      return new Response(null, { status: 302, headers: { Location: location } })
    })
    const response = await worker.fetch(new Request(publicOrigin + '/crm/api/auth:check'), env)
    assert.equal(calls, 1)
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), expected)
  }
})

test('native root asset aliases keep their query and API failures never fall back to HTML', async () => {
  const worker = createWorker(async () => { throw new Error('private-token-and-server-details') })
  for (const path of ['/global.css', '/browser-checker.js?v=1']) {
    const response = await worker.fetch(new Request(publicOrigin + path), env)
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/crm' + path)
  }
  for (const backend of [origin, undefined, publicOrigin, 'https://user:secret@example.com', 'https://example.com/path', 'http://example.com']) {
    const response = await worker.fetch(new Request(publicOrigin + '/crm/api/auth:check'), { ...env, BACKEND_ORIGIN: backend })
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { error: 'Backend temporarily unavailable' })
  }
  for (const status of [401, 403, 404, 503]) {
    const response = await createWorker(async () => Response.json({ error: 'test' }, { status })).fetch(new Request(publicOrigin + '/prospect-api/designs/invalid'), env)
    assert.equal(response.status, status)
    assert.equal(response.headers.get('Content-Type'), 'application/json')
  }
})
