import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { context } from './context.mjs'
import { NocoBaseClient } from '../src/crm.mjs'

const { crm, env } = await context()
const before = (await crm.request('six_crm', 'summary')).data.metrics
const key = randomUUID()
const password = `${randomUUID()}aA1!`
const account = await crm.create('users', { username: `crm-test-${key.slice(0, 12)}`, nickname: 'CRM integration fixture', email: `${key}@example.invalid`, password, roles: ['sixsummit_caller'] })
const staff = new NocoBaseClient({ url: env.NOCOBASE_URL || 'http://127.0.0.1:13000/crm' })
const post = (client, action, body) => client.request('six_crm', action, { body })
const count = async (leadId) => (await crm.list('six_activities', { leadId }, { paginate: false })).length
let checks = 0
try {
  await staff.signIn(account.username, password)
  staff.role = 'sixsummit_caller'
  const callers = (await staff.request('six_crm', 'callers')).data
  assert.ok(callers.some((caller) => caller.id === account.id))
  assert.ok(callers.every((caller) => Object.keys(caller).sort().join(',') === 'id,name')); checks++
  const lead = await crm.create('six_leads', { fingerprint: `smoke:${key}`, businessName: 'CRM flow demonstration', phone: '+13065550101', city: 'Regina', province: 'SK', country: 'CA', contactStatus: 'new', isDemo: true })
  const event = (disposition, extra = {}) => ({ leadId: lead.id, requestId: randomUUID(), disposition, kind: 'call', ...extra })
  await assert.rejects(post(staff, 'recordOutcome', event('interested')), /403/)
  await post(staff, 'assign', { leadId: lead.id }); checks++
  await assert.rejects(post(staff, 'assign', { leadId: lead.id, userId: 1 }), /403/); checks++
  await assert.rejects(post(staff, 'recordOutcome', event('callback_requested')), /422/)
  assert.equal(await count(lead.id), 1); checks++ // Assignment only; failed outcome rolled back.
  const followUpAt = new Date(Date.now() + 2 * 86400000).toISOString()
  const first = await post(staff, 'recordOutcome', event('callback_requested', { followUpAt, callerId: 1 }))
  assert.equal(first.data.lead.contactStatus, 'follow_up')
  assert.equal(first.data.activity.callerId, account.id); checks++
  const meeting = await post(staff, 'recordOutcome', event('meeting_booked', { kind: 'stage_update', meetingAt: followUpAt }))
  assert.equal(meeting.data.lead.contactStatus, 'meeting_booked'); checks++
  const retry = event('voicemail')
  const responses = await Promise.all([post(staff, 'recordOutcome', retry), post(staff, 'recordOutcome', retry)])
  assert.equal(responses.filter((result) => result.data.replayed).length, 1)
  assert.ok(responses.every((result) => result.data.lead.contactStatus === 'meeting_booked'))
  assert.equal(await count(lead.id), 4); checks++
  await assert.rejects(post(staff, 'recordOutcome', { ...retry, notes: 'Different payload' }), /409/); checks++
  const won = event('won', { kind: 'stage_update', valueCents: 250000 })
  const result = await post(staff, 'recordOutcome', won)
  assert.equal(result.data.lead.contactStatus, 'won')
  assert.equal(result.data.lead.nextFollowUpAt, null)
  assert.equal((await post(staff, 'recordOutcome', won)).data.replayed, true); checks++
  await assert.rejects(crm.update('six_leads', lead.id, { contactStatus: 'new' }), /409/)
  await assert.rejects(crm.request('six_activities', 'destroy', { query: { filterByTk: first.data.activity.id }, body: {} }), /409/); checks++
  await assert.rejects(post(staff, 'reopen', { leadId: lead.id, reason: 'Test only' }), /403/)
  await post(crm, 'reopen', { leadId: lead.id, reason: 'Integration test of an audited reopen.' }); checks++
  await post(staff, 'recordOutcome', event('do_not_call', { kind: 'stage_update' }))
  await assert.rejects(post(staff, 'recordOutcome', event('interested')), /409/)
  await assert.rejects(post(crm, 'reopen', { leadId: lead.id, reason: 'This must fail for opt-outs.' }), /409/); checks++
  const after = (await crm.request('six_crm', 'summary')).data.metrics
  assert.deepEqual(after, before); checks++
  const unauthenticated = await fetch(new URL('six_crm:summary', crm.url))
  assert.ok([401, 403].includes(unauthenticated.status)); checks++
  console.log(JSON.stringify({ ok: true, checks, fixtureLeadId: lead.id, demoRecordsExcludedFromAnalytics: true }))
} finally {
  await crm.request('users', 'destroy', { query: { filterByTk: account.id }, body: {} })
}
