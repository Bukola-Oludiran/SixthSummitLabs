import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { businessBrief, readBusinessBrief } from '../src/business-brief.mjs'

const pilot = JSON.parse(await readFile(new URL('../config/pilot.json', import.meta.url), 'utf8'))
const now = new Date('2026-10-18T01:00:00Z') // Still October 17 in Edmonton.
const lead = { id: 1, businessName: 'Test business', phone: '+13065550101', city: 'Regina', province: 'SK', contactStatus: 'follow_up', qualifiedAt: now.toISOString(), websiteCheckedAt: now.toISOString(), websiteStatus: 'none_found', websiteEvidence: { searches: [{ query: 'name', outcome: 'complete' }, { query: 'phone', outcome: 'complete' }] }, briefVersion: 2, nextFollowUpAt: '2026-10-17T22:00:00Z', designSharingEnabled: true }

test('business briefing excludes demos, old concepts, closed follow-ups and unsourced financial claims', () => {
  const report = businessBrief({ pilot, now, sales: { metrics: { wonValueCents: 250000 } }, leads: [lead, { ...lead, id: 2, isDemo: true }, { ...lead, id: 3, contactStatus: 'do_not_call' }], concepts: [{ leadId: 1, briefVersion: 1, status: 'failed' }, { leadId: 1, briefVersion: 2, status: 'needs_review', conceptNumber: 1 }, { leadId: 2, briefVersion: 2, status: 'ready', publicationKey: 'demo' }], runs: [] })
  assert.equal(report.businessDate, '2026-10-17')
  assert.equal(report.dailyTarget.qualifiedToday, 2)
  assert.equal(report.pipeline.totalBusinesses, 2)
  assert.equal(report.pipeline.currentlyCallable, 1)
  assert.equal(report.nextActions.followUps.length, 1)
  assert.equal(report.nextActions.followUps[0].overdue, true)
  assert.equal(report.designs.totalCurrentConcepts, 1)
  assert.equal(report.sales.metrics.wonValueCents, 250000)
  assert.equal(report.billing.collectedRevenueCents, null)
  assert.equal(report.billing.outstandingInvoicesCents, null)
  assert.equal(report.sharing.localOnly, true)
})

test('briefing reads CRM resources without changing records and fails rather than inventing a zero report', async () => {
  const calls = []
  const crm = {
    async list(resource) { calls.push(resource); return resource === 'six_leads' ? [lead] : [] },
    async request(resource, action, options) { assert.equal(options.body, undefined); calls.push(`${resource}:${action}`); return { data: { range: options.query, metrics: { callAttempts: 1 } } } },
    async create() { assert.fail('Reporting must not create data') },
    async update() { assert.fail('Reporting must not update data') },
  }
  const report = await readBusinessBrief(crm, { pilot, now, days: 7 })
  assert.equal(report.sales.metrics.callAttempts, 1)
  assert.deepEqual(calls.sort(), ['six_concepts', 'six_crm:summary', 'six_leads', 'six_runs'])
  await assert.rejects(() => readBusinessBrief({ ...crm, list: async () => { throw new Error('Offline') } }, { pilot, now }), /Offline/)
  await assert.rejects(() => readBusinessBrief(crm, { pilot, now, days: 0 }), /Reporting days/)
})
