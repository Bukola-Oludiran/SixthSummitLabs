import test from 'node:test'
import assert from 'node:assert/strict'
import { CrmApi, crmRole } from '../src/crm/api.js'
import { cadCents, galleryPath, outcomePayload, qualifiedForCall, safeLink } from '../src/crm/domain.js'
import config from '../vite.config.js'

test('staff API uses only the explicit session and keeps server diagnostics private', async () => {
  let request
  const api = new CrmApi({
    token: 'private-test-token',
    role: 'sixsummit_caller',
    fetch: async function (url, options) {
      assert.equal(this, globalThis)
      request = { url, ...options }
      return { ok: true, json: async () => ({ data: { total: 4 } }) }
    },
  })
  assert.deepEqual(await api.get('leads', { search: 'A & B', page: 2 }), { total: 4 })
  assert.equal(request.credentials, 'omit')
  assert.equal(request.cache, 'no-store')
  assert.equal(request.headers.Authorization, 'Bearer private-test-token')
  assert.equal(request.headers['X-Role'], 'sixsummit_caller')
  assert.ok(!request.url.includes('private-test-token'))
  assert.equal(new URL(request.url, 'http://localhost').searchParams.get('search'), 'A & B')
  api.fetch = async () => ({
    ok: false,
    status: 500,
    json: () => {
      throw new Error('Must never read the secret diagnostics')
    },
  })
  await assert.rejects(
    () => api.get('leads'),
    (error) => error.status === 500 && !error.message.includes('secret')
  )
})

test('an expired session notifies the shell, and caller permission failures do not expire it', async () => {
  let expired = 0
  const api = new CrmApi({
    token: 'test-token',
    expired: () => expired++,
    fetch: async () => ({ ok: false, status: 401 }),
  })
  await assert.rejects(() => api.get('leads'), /expired/)
  assert.equal(expired, 1)
  api.fetch = async () => ({ ok: false, status: 403 })
  await assert.rejects(() => api.get('leads'), /permission/)
  assert.equal(expired, 1)
  assert.equal(crmRole({ roles: [{ name: 'member' }] }), null)
  assert.equal(crmRole({ roles: [{ name: 'sixsummit_caller' }] }), 'sixsummit_caller')
})

test('CAD project values retain cents exactly and reject malformed or unsafe amounts', () => {
  assert.equal(cadCents('2500.01'), 250001)
  assert.equal(cadCents('0'), 0)
  assert.equal(cadCents('10.1'), 1010)
  for (const input of ['-10', '1.001', '1e6', '', '9007199254740991']) assert.throws(() => cadCents(input))
})

test('sales update payloads clear irrelevant dates and use explicit timestamps', () => {
  const form = new FormData()
  form.set('kind', 'stage_update')
  form.set('disposition', 'won')
  form.set('valueDollars', '1200.30')
  form.set('followUpAt', '2020-01-01T12:00')
  const won = outcomePayload(form, 7)
  assert.equal(won.valueCents, 120030)
  assert.equal(won.followUpAt, null)
  form.set('disposition', 'no_answer')
  assert.throws(() => outcomePayload(form, 7), /without a call/)
  form.set('kind', 'call')
  form.set('disposition', 'meeting_booked')
  form.set('meetingAt', new Date(Date.now() + 86400000).toISOString())
  assert.match(outcomePayload(form, 7).meetingAt, /Z$/)
  form.set('meetingAt', '2020-01-01T12:00')
  assert.throws(() => outcomePayload(form, 7), /future/)
})

test('calling requires fresh complete research, and public links never accept executable URLs', () => {
  const lead = {
    businessName: 'Test business',
    phone: '+13065550101',
    city: 'Regina',
    province: 'SK',
    qualifiedAt: new Date().toISOString(),
    websiteStatus: 'none_found',
    websiteCheckedAt: new Date().toISOString(),
    websiteEvidence: {
      searches: [
        { query: 'one', outcome: 'complete' },
        { query: 'two', outcome: 'complete' },
      ],
    },
    contactStatus: 'new',
  }
  assert.equal(qualifiedForCall(lead), true)
  assert.equal(qualifiedForCall({ ...lead, websiteCheckedAt: '2020-01-01' }), false)
  assert.equal(
    qualifiedForCall({
      ...lead,
      websiteCheckedAt: '2020-01-01',
      lastContactAt: new Date().toISOString(),
      contactStatus: 'follow_up',
    }),
    true
  )
  assert.equal(qualifiedForCall({ ...lead, websiteStatus: 'platform_only' }), false)
  assert.equal(qualifiedForCall({ ...lead, contactStatus: 'do_not_call' }), false)
  assert.equal(
    qualifiedForCall({ ...lead, websiteEvidence: { searches: [{ query: 'one', outcome: 'complete' }] } }),
    false
  )
  assert.equal(safeLink('javascript:alert(1)'), null)
  assert.equal(safeLink('https://user:secret@example.com'), null)
  assert.equal(galleryPath({ designShareToken: 'invalid' }), null)
})

test('staff SPA routes and native administration/API routes are separated in both preview and dev', () => {
  assert.ok(config.server.fs.deny.includes('**/backend/**'))
  for (const mode of ['server', 'preview']) {
    assert.equal(config[mode].proxy['/prospect-api'].target, 'http://127.0.0.1:13000')
    const pattern = Object.keys(config[mode].proxy).find((key) => key.startsWith('^/crm/'))
    const proxy = new RegExp(pattern)
    for (const url of [
      '/crm',
      '/crm/',
      '/crm/leads',
      '/crm/leads/8',
      '/crm/follow-ups',
      '/crm/analytics',
      '/crm/designs',
    ])
      assert.equal(proxy.test(url), false, url)
    for (const url of ['/crm/api/auth:signIn', '/crm/admin/sixsummit', '/crm/static/plugins/a.js', '/crm/ws'])
      assert.equal(proxy.test(url), true, url)
  }
})
