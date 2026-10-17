import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ingestCandidates, runDesignQueue, budgetDate } from '../src/pipeline.mjs'
import { checkWebsite } from '../src/sources/search.mjs'

const pilot = JSON.parse(await readFile(new URL('../config/pilot.json', import.meta.url), 'utf8'))
const now = new Date('2026-10-17T17:00:00Z')
const business = (n = 1) => ({
  businessName: `Test business ${n}`, phone: `+1306555${String(100 + n).padStart(4, '0')}`, city: 'Regina', province: 'SK',
  websiteStatus: 'none_found', websiteCheckedAt: now.toISOString(), websiteEvidence: { searches: [{ query: `name ${n}`, outcome: 'complete' }, { query: `phone ${n}`, outcome: 'complete' }] }, logoStatus: 'not_found',
  source: { sourceKey: `fixture:${n}`, sourceUrl: `https://example.invalid/${n}`, sourceName: 'TEST ONLY' },
})

class MemoryCRM {
  rows = Object.fromEntries(['six_leads', 'six_concepts', 'six_sources'].map((name) => [name, []]))
  nextId = 1
  async list(table, filter = {}, query = {}) {
    const matches = this.rows[table].filter((row) => Object.entries(filter).every(([key, value]) => typeof value === 'object' && value?.$not === null ? row[key] != null : row[key] === value))
    return structuredClone(query.pageSize ? matches.slice(0, query.pageSize) : matches)
  }
  async create(table, values) { const row = { id: this.nextId++, ...structuredClone(values) }; this.rows[table].push(row); return structuredClone(row) }
  async update(table, id, values) { const row = this.rows[table].find((entry) => entry.id === id); Object.assign(row, structuredClone(values)); return structuredClone(row) }
}

test('daily cap is shared across all cities and survives repeat imports', async () => {
  const crm = new MemoryCRM()
  const input = Array.from({ length: 12 }, (_, i) => business(i + 1))
  input[1].city = 'Calgary'; input[1].province = 'AB'
  const first = await ingestCandidates(crm, input, pilot, now)
  assert.equal(first.qualified, 10)
  assert.equal(first.queued, 30)
  const second = await ingestCandidates(crm, input, pilot, now)
  assert.equal(second.qualified, 0)
  assert.equal(second.queued, 0)
  assert.equal(second.usedToday, 10)
  const next = await ingestCandidates(crm, input, pilot, new Date('2026-10-18T17:00:00Z'))
  assert.equal(next.qualified, 2)
  assert.equal(crm.rows.six_concepts.length, 36)
})

test('stable source identity tolerates an updated address and retains do-not-call state', async () => {
  const crm = new MemoryCRM()
  const lead = business()
  lead.websiteStatus = 'not_checked'
  await ingestCandidates(crm, [lead], pilot, now)
  const record = crm.rows.six_leads[0]
  await crm.update('six_leads', record.id, { contactStatus: 'do_not_call', assignedTo: 'Bukola', businessNotes: 'Opted out.' })
  const result = await ingestCandidates(crm, [{ ...business(), address: 'Updated address' }], pilot, now)
  assert.equal(result.qualified, 0)
  assert.equal(crm.rows.six_leads.length, 1)
  assert.equal(crm.rows.six_leads[0].assignedTo, 'Bukola')
  assert.equal(crm.rows.six_leads[0].businessNotes, 'Opted out.')
  assert.equal(crm.rows.six_concepts.length, 0)
})

test('lead persists when branding still needs research, and jobs can be queued later', async () => {
  const crm = new MemoryCRM()
  const first = await ingestCandidates(crm, [{ ...business(), logoStatus: 'not_checked' }], pilot, now)
  assert.equal(first.qualified, 1)
  assert.equal(first.queued, 0)
  assert.equal(first.needsBrandReview, 1)
  const second = await ingestCandidates(crm, [business()], pilot, now)
  assert.equal(second.qualified, 0)
  assert.equal(second.queued, 3)
})

test('one design failure preserves the lead and lets the other concepts complete', async () => {
  const crm = new MemoryCRM()
  await ingestCandidates(crm, [business()], pilot, now)
  const result = await runDesignQueue(crm, pilot, async (job) => {
    if (job.conceptNumber === 2) throw new Error('Provider body with sensitive information')
    return { htmlPath: `private/${job.jobKey}/page.html` }
  }, { now })
  assert.deepEqual(result, { ready: 2, failed: 1, held: 0 })
  assert.equal(crm.rows.six_leads[0].designStatus, 'failed')
  assert.ok(crm.rows.six_leads[0].qualifiedAt)
  assert.doesNotMatch(crm.rows.six_concepts.find((job) => job.status === 'failed').error, /sensitive/)
})

test('opt-out or stale website evidence prevents queued work from rendering', async () => {
  const crm = new MemoryCRM()
  await ingestCandidates(crm, [business()], pilot, now)
  crm.rows.six_leads[0].contactStatus = 'do_not_call'
  const result = await runDesignQueue(crm, pilot, async () => assert.fail('must not render'), { now })
  assert.equal(result.held, 3)
})

test('freeform jobs wait for an author, then require visual approval after rendering', async () => {
  const crm = new MemoryCRM()
  await ingestCandidates(crm, [business()], pilot, now)
  const waiting = await runDesignQueue(crm, pilot, async () => {
    throw Object.assign(new Error('No authored homepage yet'), { code: 'AWAITING_ASA_AUTHOR' })
  }, { now })
  assert.deepEqual(waiting, { ready: 0, failed: 0, held: 0, awaitingAuthor: 3 })
  assert.ok(crm.rows.six_concepts.every((job) => job.status === 'awaiting_author' && !job.error))
  const reviewed = await runDesignQueue(crm, pilot, async () => ({ status: 'needs_review', htmlPath: 'private/index.html' }), { now })
  assert.deepEqual(reviewed, { ready: 0, failed: 0, held: 0, needsReview: 3 })
  assert.equal(crm.rows.six_leads[0].designStatus, 'needs_review')
})

test('new jobs are not starved by older jobs awaiting manual authoring', async () => {
  const crm = new MemoryCRM()
  await ingestCandidates(crm, [business()], pilot, now)
  crm.rows.six_concepts.forEach((job) => { job.status = 'awaiting_author' })
  await ingestCandidates(crm, [business(2)], pilot, now)
  const rendered = []
  await runDesignQueue(crm, pilot, async (job) => { rendered.push(job.leadId); return { status: 'needs_review' } }, { now, limit: 3 })
  assert.deepEqual(rendered, Array(3).fill(crm.rows.six_leads[1].id))
})

test('search failures, empty evidence and possible business domains never establish no website', async () => {
  for (const body of [{ results: [] }, { results: [{ title: 'Business', url: 'https://example.com' }] }, { results: [{ url: 'https://yellowpages.ca/x' }], unresponsive_engines: [['bing', 'timeout']] }]) {
    const lead = await checkWebsite(business(), { endpoint: 'http://localhost:8080', now, fetch: async () => new Response(JSON.stringify(body)) })
    assert.equal(lead.websiteStatus, 'uncertain')
  }
  const lead = await checkWebsite(business(), { endpoint: 'http://localhost:8080', now, fetch: async () => new Response(JSON.stringify({ results: [{ title: 'Profile', url: 'https://www.facebook.com/example' }] })) })
  assert.equal(lead.websiteStatus, 'social_only')
  await assert.rejects(() => checkWebsite(business()), /Configure/)
})

test('daily budget uses Edmonton local midnight rather than UTC midnight', () => {
  assert.equal(budgetDate(new Date('2026-10-18T01:00:00Z')), '2026-10-17')
  assert.equal(budgetDate(new Date('2026-10-18T07:00:00Z')), '2026-10-18')
})
