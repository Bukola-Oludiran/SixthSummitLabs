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
  const ownDetail = (await staff.request('six_crm', 'detail', { query: { leadId: lead.id } })).data
  assert.equal(ownDetail.lead.id, lead.id)
  assert.ok(Array.isArray(ownDetail.activities) && Array.isArray(ownDetail.concepts)); checks++
  const note = { leadId: lead.id, notes: 'Workspace integration note.', requestId: randomUUID() }
  const beforeNotes = await count(lead.id)
  const noteResults = await Promise.all([post(staff, 'note', note), post(staff, 'note', note)])
  assert.equal(noteResults[0].data.id, noteResults[1].data.id)
  assert.equal(await count(lead.id), beforeNotes + 1)
  assert.equal(noteResults[0].data.callerId, account.id); checks++
  await assert.rejects(post(staff, 'note', { ...note, notes: 'Conflicting retry' }), /409/); checks++
  const listing = (await crm.request('six_crm', 'leads', { query: { showDemo: 'true', search: key } })).data
  assert.ok(Array.isArray(listing.items))
  assert.equal(listing.pageSize, 20); checks++
  const callerListing = (await staff.request('six_crm', 'leads')).data
  assert.ok(callerListing.items.every(row => !row.isDemo))
  await assert.rejects(staff.request('six_crm', 'leads', { query: { showDemo: 'true' } }), /403/); checks++
  await post(staff, 'sharing', { leadId: lead.id, enabled: false })
  assert.equal((await staff.request('six_crm', 'detail', { query: { leadId: lead.id } })).data.lead.designSharingEnabled, false); checks++
  const other = await crm.create('six_leads', { fingerprint: `smoke:other:${key}`, businessName: 'Other caller visibility demonstration', city: 'Calgary', isDemo: true })
  const admin = (await crm.request('auth', 'check')).data
  await post(crm, 'assign', { leadId: other.id, userId: admin.id })
  await assert.rejects(staff.request('six_crm', 'detail', { query: { leadId: other.id } }), /404/)
  await assert.rejects(post(staff, 'note', { leadId: other.id, notes: 'Must not be saved', requestId: randomUUID() }), /404/)
  await assert.rejects(post(staff, 'sharing', { leadId: other.id, enabled: true }), /404/); checks++
  const job = await crm.create('six_concepts', { leadId: lead.id, jobKey: `smoke:${key}:1`, briefVersion: 1, conceptNumber: 1, status: 'needs_review' })
  await assert.rejects(post(staff, 'reviewDesign', { leadId: lead.id, conceptId: job.id, status: 'ready', reviewed: true }), /403/)
  await assert.rejects(post(crm, 'reviewDesign', { leadId: lead.id, conceptId: job.id, status: 'ready', reviewed: true }), /422/)
  assert.equal((await crm.list('six_concepts', { id: job.id }))[0].status, 'needs_review'); checks++
  const after = (await crm.request('six_crm', 'summary')).data.metrics
  assert.deepEqual(after, before); checks++
  const unauthenticated = await fetch(new URL('six_crm:summary', crm.url))
  assert.ok([401, 403].includes(unauthenticated.status)); checks++
  console.log(JSON.stringify({ ok: true, checks, fixtureLeadId: lead.id, demoRecordsExcludedFromAnalytics: true }))
} finally {
  await crm.request('users', 'destroy', { query: { filterByTk: account.id }, body: {} })
}
