import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createBackendRuntime, publicationRepository } from '../src/backend-runtime.mjs'

function fixture(options = {}) {
  const records = { six_leads: [], six_concepts: [] }
  const db = {
    getRepository(table) {
      return {
        async find({ filter = {} }) {
          return records[table].filter(row => Object.entries(filter).every(([key, value]) => row[key] === value))
            .map(row => ({ toJSON: () => ({ ...row }) }))
        },
        async findOne() { return records[table][0] || null },
        async update({ filterByTk, values }) { Object.assign(records[table].find(row => row.id === filterByTk), values) },
      }
    },
  }
  const app = { db, isStarted: async () => true }
  const runtime = createBackendRuntime({
    app, env: { PUBLIC_SITE_URL: 'https://studio.example' },
    withLock: work => work(), logger: { error() {} }, ...options,
  })
  return { runtime, app, db, records }
}

async function listen(handler) {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { server, url: `http://127.0.0.1:${server.address().port}` }
}

test('the embedded publication adapter cannot read other collections or change sales fields', async () => {
  const { db, records } = fixture()
  records.six_leads.push({ id: 7, contactStatus: 'new' })
  const crm = publicationRepository(db)
  assert.deepEqual(await crm.list('six_leads', { id: 7 }), records.six_leads)
  await assert.rejects(crm.list('users'), /Unsupported/)
  await assert.rejects(crm.update('six_leads', 7, { contactStatus: 'won' }), /Unsupported/)
  assert.equal(records.six_leads[0].contactStatus, 'new')
  await crm.update('six_leads', 7, { designShareUrl: 'https://studio.example/designs/example' })
  assert.equal(records.six_leads[0].designShareUrl, 'https://studio.example/designs/example')
})

test('one listener serves readiness and prospect routes while leaving native CRM requests to the gateway', async () => {
  const { app, runtime, records } = fixture()
  const token = 'a'.repeat(43)
  records.six_leads.push({ id: 7, businessName: 'Fictional test', city: 'Regina', designShareToken: token, designSharingEnabled: true })
  const { server, url } = await listen(async (req, res) => {
    if (await runtime.handle(req, res) === false) { res.writeHead(418); res.end('native gateway') }
  })
  try {
    assert.equal((await fetch(`${url}/health`)).status, 200)
    assert.equal((await fetch(`${url}/health`, { method: 'HEAD' })).status, 200)
    assert.equal((await fetch(`${url}/health`, { method: 'POST' })).status, 405)
    app.isStarted = async () => false
    assert.equal((await fetch(`${url}/health`)).status, 503)
    app.isStarted = async () => true
    const original = app.db.getRepository
    app.db.getRepository = () => { throw new Error('private database diagnostic') }
    const unavailable = await fetch(`${url}/health`)
    assert.equal(unavailable.status, 503)
    assert.deepEqual(await unavailable.json(), { ok: false })
    app.db.getRepository = original
    const gallery = await fetch(`${url}/prospect-api/designs/${token}`)
    assert.equal(gallery.status, 200)
    assert.equal((await gallery.json()).businessName, 'Fictional test')
    records.six_leads[0].designSharingEnabled = false
    assert.equal((await fetch(`${url}/prospect-api/designs/${token}`)).status, 404)
    assert.equal((await fetch(`${url}/prospect-api/staff/leads/7/concepts/9/desktop.png`)).status, 401)
    assert.equal((await fetch(`${url}/prospect-api/unknown`)).status, 404)
    const native = await fetch(`${url}/crm/api/auth:check`)
    assert.equal(native.status, 418)
    assert.equal(await native.text(), 'native gateway')
    await runtime.stop()
    assert.equal((await fetch(`${url}/health`)).status, 503)
    assert.equal((await fetch(`${url}/prospect-api/designs/${token}`)).status, 503)
  } finally { await runtime.stop(); await new Promise(resolve => server.close(resolve)) }
})

test('embedded private previews retain the caller token and reject revoked or foreign CRM access', async () => {
  const requests = []
  const native = await listen((req, res) => {
    requests.push({ authorization: req.headers.authorization, role: req.headers['x-role'], url: req.url })
    const status = req.headers.authorization === 'Bearer expired' ? 401 : 403
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ errors: [{ message: 'private diagnostic' }] }))
  })
  const { runtime } = fixture({ env: { NOCOBASE_URL: `${native.url}/crm` } })
  const { server, url } = await listen(runtime.handle)
  try {
    for (const [token, status] of [['expired', 401], ['foreign', 403]]) {
      const response = await fetch(`${url}/prospect-api/staff/leads/7/concepts/9/desktop.png`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Role': 'sixsummit_caller' },
      })
      assert.equal(response.status, status)
      assert.ok(!(await response.text()).includes('diagnostic'))
    }
    assert.deepEqual(requests.map(row => row.authorization), ['Bearer expired', 'Bearer foreign'])
    assert.ok(requests.every(row => row.role === 'sixsummit_caller' && row.url.startsWith('/crm/api/six_crm:detail')))
  } finally {
    await runtime.stop()
    await Promise.all([server, native.server].map(server => new Promise(resolve => server.close(resolve))))
  }
})

test('publication cannot overlap and shutdown drains the running job before closing storage', async () => {
  let finish
  let publishes = 0
  let closes = 0
  const { runtime } = fixture({
    store: { close() { closes++ } },
    publish: async () => { publishes++; await new Promise(resolve => { finish = resolve }); return { failed: 0 } },
  })
  const first = runtime.sync()
  const duplicate = runtime.sync()
  assert.equal(publishes, 1)
  const stop = runtime.stop()
  assert.equal(closes, 0)
  finish()
  await Promise.all([first, duplicate, stop])
  assert.equal(closes, 1)
  await runtime.stop()
  await runtime.sync()
  assert.equal(publishes, 1)
  assert.equal(closes, 1)
})
