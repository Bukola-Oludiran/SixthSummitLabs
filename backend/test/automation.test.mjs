import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { environment } from '../scripts/environment.mjs'
import { automationConfiguration, automationStatus, assertAuthorable } from '../src/automation.mjs'

const pilot = JSON.parse(await readFile(new URL('../config/pilot.json', import.meta.url)))
const now = new Date('2026-10-19T14:00:00Z')
const lead = {
  id: 1, businessName: 'Fictional test only', phone: '+13065550101', city: 'Regina', province: 'SK',
  websiteStatus: 'none_found', websiteCheckedAt: now.toISOString(), qualifiedAt: now.toISOString(),
  websiteEvidence: { searches: [{ query: 'query one', outcome: 'complete' }, { query: 'query two', outcome: 'complete' }] },
  contactStatus: 'new', briefVersion: 1, logoStatus: 'not_found',
}
const job = { id: 1, leadId: 1, briefVersion: 1, conceptNumber: 1, status: 'queued' }

test('the automation profile is explicit, missing files fail, and development credentials are not inherited', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'sixsummit-automation-'))
  try {
    const file = path.join(folder, 'profile')
    await writeFile(file, 'NOCOBASE_URL=https://6ixsummitlabs.com/crm\nNOCOBASE_API_KEY=test-private-token\n')
    const env = await environment({ file, inherit: { PATH: '/bin' } })
    assert.equal(env.NOCOBASE_API_KEY, 'test-private-token')
    assert.equal(env.GIT_TOKEN, undefined)
    assert.equal(env.INIT_ROOT_PASSWORD, undefined)
    assert.equal(env.DB_PASSWORD, undefined)
    await assert.rejects(() => environment({ file: path.join(folder, 'missing'), inherit: {} }), { code: 'ENOENT' })
  } finally { await rm(folder, { recursive: true, force: true }) }
})

test('live runs reject local URLs and require an API token instead of falling back to administrator sign-in', () => {
  const env = { NOCOBASE_URL: 'https://6ixsummitlabs.com/crm', PUBLIC_SITE_URL: 'https://6ixsummitlabs.com', NOCOBASE_API_KEY: 'test', INIT_ROOT_PASSWORD: 'must-not-be-used' }
  assert.equal(automationConfiguration(env, { storage: false }).ok, true)
  assert.deepEqual(automationConfiguration({ ...env, NOCOBASE_API_KEY: '' }, { storage: false }).missing, ['NOCOBASE_API_KEY'])
  assert.equal(automationConfiguration({ ...env, NOCOBASE_URL: 'http://127.0.0.1:13000/crm' }, { storage: false }).ok, false)
  assert.equal(automationConfiguration({ ...env, PUBLIC_SITE_URL: 'https://6ixsummitlabs.com.evil.example' }, { storage: false }).ok, false)
  assert.ok(automationConfiguration(env).missing.includes('DESIGN_S3_SECRET_ACCESS_KEY'))
})

test('daily quota uses Edmonton midnight, excludes demos, and resumes only eligible current incomplete jobs', () => {
  const leads = [lead,
    { ...lead, id: 2, isDemo: true },
    { ...lead, id: 3, qualifiedAt: '2026-10-19T05:59:59Z' },
    { ...lead, id: 4, contactStatus: 'do_not_call' },
    { ...lead, id: 5, websiteCheckedAt: '2026-01-01' },
  ]
  const jobs = [job, { ...job, id: 2, leadId: 2 }, { ...job, id: 3, leadId: 4 },
    { ...job, id: 4, leadId: 5 }, { ...job, id: 5, briefVersion: 2 },
    { ...job, id: 6, artifactManifest: 's3://test/verified' },
    { ...job, id: 7, status: 'needs_review', artifactManifest: 's3://test/review' },
  ]
  const status = automationStatus(leads, jobs, pilot, now)
  assert.equal(status.qualifiedToday, 3) // Closed/stale rows still consume their original daily allowance.
  assert.equal(status.remainingToday, 7)
  assert.deepEqual(status.pending.map(job => job.conceptId), [1])
  assert.equal(status.needsReview, 1)
  assert.equal(status.budgetDate, '2026-10-19')
})

test('authoring cannot replace verified uploads or proceed for stale, opted-out or old-version leads', () => {
  assert.doesNotThrow(() => assertAuthorable(job, lead, pilot, now))
  for (const altered of [{ ...job, artifactManifest: 's3://test/existing' }, { ...job, publicationKey: 'existing' }, { ...job, briefVersion: 2 }, { ...job, status: 'ready' }]) assert.throws(() => assertAuthorable(altered, lead, pilot, now))
  for (const altered of [{ ...lead, contactStatus: 'do_not_call' }, { ...lead, isDemo: true }, { ...lead, websiteCheckedAt: '2026-01-01' }]) assert.throws(() => assertAuthorable(job, altered, pilot, now))
})

test('the saved schedule matches the requested time and does not claim registration', async () => {
  const schedule = JSON.parse(await readFile(new URL('../automation/schedule.json', import.meta.url)))
  assert.equal(schedule.timeZone, 'America/Edmonton')
  assert.equal(schedule.rrule, 'RRULE:FREQ=DAILY;BYHOUR=8;BYMINUTE=0;BYSECOND=0')
  assert.equal(schedule.activation, 'pending_credentials_and_manual_pilot')
})
