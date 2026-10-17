import test from 'node:test'
import assert from 'node:assert/strict'
import { NocoBaseClient } from '../src/crm.mjs'

test('encodes NocoBase filters and keeps credentials in headers', async () => {
  let captured
  const crm = new NocoBaseClient({ url: 'http://127.0.0.1:13000', token: 'test-placeholder', fetch: async (url, options) => {
    captured = { url, options }
    return Response.json({ data: [] })
  } })
  await crm.list('six_leads', { phone: '+13065550101' })
  assert.equal(captured.url.pathname, '/api/six_leads:list')
  assert.deepEqual(JSON.parse(captured.url.searchParams.get('filter')), { phone: '+13065550101' })
  assert.equal(captured.options.headers.Authorization, 'Bearer test-placeholder')
  assert.ok(!captured.url.toString().includes('test-placeholder'))
})

test('does not expose response bodies or credentials in API errors', async () => {
  const crm = new NocoBaseClient({ url: 'http://127.0.0.1:13000', fetch: async () => new Response('secret-placeholder', { status: 403 }) })
  await assert.rejects(crm.list('six_leads'), { message: 'NocoBase six_leads:list failed (403).' })
})

test('encodes association and sort arrays as NocoBase query parameters', async () => {
  let captured
  const crm = new NocoBaseClient({ url: 'http://localhost:13000', fetch: async (url) => { captured = url; return Response.json({ data: [] }) } })
  await crm.request('desktopRoutes', 'create', { query: { updateAssociationValues: ['children'], sort: ['-createdAt'] }, body: {} })
  assert.deepEqual(captured.searchParams.getAll('updateAssociationValues[]'), ['children'])
  assert.deepEqual(captured.searchParams.getAll('sort[]'), ['-createdAt'])
})

test('authentication and collection resources remain HTTP paths rather than URL schemes', async () => {
  const urls = []
  const crm = new NocoBaseClient({ url: 'http://127.0.0.1:13000', fetch: async (url) => {
    urls.push(url.toString())
    return Response.json({ data: { token: 'session-placeholder' } })
  } })
  await crm.signIn('admin@example.invalid', 'password-placeholder')
  await crm.request('collections', 'list')
  assert.deepEqual(urls, ['http://127.0.0.1:13000/api/auth:signIn', 'http://127.0.0.1:13000/api/collections:list'])
})
