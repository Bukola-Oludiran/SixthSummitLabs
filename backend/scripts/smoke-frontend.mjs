import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { context } from './context.mjs'
import { backendRoot } from './environment.mjs'
import { newDesignShare } from '../src/design-sharing.mjs'

const { crm, env } = await context()
const target = new URL(env.FRONTEND_URL || 'http://127.0.0.1:5173')
if (
  !['http:', 'https:'].includes(target.protocol) ||
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
  target.username ||
  target.password ||
  target.pathname !== '/'
)
  throw new Error('Frontend smoke tests require a loopback HTTP(S) origin.')
const require = createRequire(path.join(backendRoot, 'nocobase/package.json'))
const module = await import(pathToFileURL(env.PLAYWRIGHT_MODULE || require.resolve('playwright')).href)
const { chromium } = module.default || module
const output = await mkdtemp(path.join(os.tmpdir(), 'sixsummit-crm-browser-'))
const key = randomUUID()
const password = `${randomUUID()}aA1!`
const secrets = [env.INIT_ROOT_PASSWORD, password, crm.token].filter(Boolean)
const safe = (value) => secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value))
let browser,
  staff,
  checks = 0
const errors = [],
  observations = []
const check = (value) => {
  assert.ok(value, `Browser check ${checks + 1} failed`)
  checks++
}
const api = (action, body) => crm.request('six_crm', action, { body })
const record = async (id) => (await crm.request('six_crm', 'detail', { query: { leadId: id } })).data
const originalMetrics = (await crm.request('six_crm', 'summary')).data.metrics
try {
  browser = await chromium.launch({ headless: true })
  staff = await crm.create('users', {
    username: `frontend-${key.slice(0, 12)}`,
    email: `${key}@example.invalid`,
    nickname: 'Frontend review caller',
    password,
    roles: ['sixsummit_caller'],
  })
  const root = (await crm.request('auth', 'check')).data
  const base = {
    businessName: `Frontend review demonstration ${key.slice(0, 6)}`,
    phone: '+13065550101',
    city: 'Regina',
    province: 'SK',
    country: 'CA',
    isDemo: true,
    qualifiedAt: new Date().toISOString(),
    websiteStatus: 'none_found',
    websiteCheckedAt: new Date().toISOString(),
    websiteEvidence: {
      searches: [
        { query: 'Fictional UI fixture one', outcome: 'complete' },
        { query: 'Fictional UI fixture two', outcome: 'complete' },
      ],
    },
    logoStatus: 'not_found',
    briefVersion: 1,
    designStatus: 'queued',
    ...newDesignShare(target.origin),
    designSharingEnabled: false,
  }
  const lead = await crm.create('six_leads', { ...base, fingerprint: `frontend:${key}` })
  for (const number of [1, 2, 3])
    await crm.create('six_concepts', {
      leadId: lead.id,
      jobKey: `${lead.id}:1:${number}`,
      conceptNumber: number,
      briefVersion: 1,
      direction: `Demonstration direction ${number}`,
      status: 'queued',
    })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    timezoneId: 'America/Edmonton',
  })
  page.on('pageerror', (error) => errors.push(safe(error.message)))
  const go = async (url) => {
    await page.goto(new URL(url, target).href, { waitUntil: 'domcontentloaded' })
    await page.locator('.crm-app').waitFor()
  }
  async function login(account, pass) {
    await page.getByLabel('Email or username').fill(account)
    await page.getByLabel('Password', { exact: true }).fill(pass)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('heading', { name: 'Your business, at a glance.' }).waitFor({ timeout: 20000 })
    await page.getByRole('heading', { name: 'Next conversations' }).waitFor()
  }
  await go('/crm')
  await page.screenshot({ path: path.join(output, 'login-wide.png') })
  await page.setViewportSize({ width: 320, height: 844 })
  await page.screenshot({ path: path.join(output, 'login-narrow.png') })
  check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(env.INIT_ROOT_EMAIL, env.INIT_ROOT_PASSWORD)
  check((await page.getByRole('link', { name: /NocoBase administration/ }).count()) === 1)
  await go(`/crm/leads/${lead.id}`)
  await page.getByRole('heading', { name: lead.businessName, exact: true }).waitFor()
  check((await page.getByText('This is a demonstration business.', { exact: false }).count()) === 1)
  await page.locator('#crm-assignee').selectOption(String(root.id))
  await page.getByRole('button', { name: 'Assign', exact: true }).click()
  await page.getByLabel('Add a note', { exact: true }).waitFor()
  await page
    .getByLabel('Add a note', { exact: true })
    .fill('Browser review note, excluded from real business activity.')
  await page.getByRole('button', { name: 'Save note', exact: true }).click()
  await page
    .locator('.crm-timeline')
    .getByText('Browser review note, excluded from real business activity.', { exact: true })
    .waitFor()
  check((await record(lead.id)).activities.some((event) => event.kind === 'note'))
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  async function outcome(disposition, kind, field, value) {
    await page.getByRole('button', { name: 'Record outcome', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('[name="kind"]').selectOption(kind)
    await dialog.locator('[name="disposition"]').selectOption(disposition)
    if (field) await dialog.locator(`[name="${field}"]`).fill(value)
    await dialog.getByRole('button', { name: 'Save outcome', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page
      .locator('.crm-timeline strong')
      .filter({
        hasText: new RegExp(
          `^${disposition.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase())}$`,
        ),
      })
      .first()
      .waitFor()
  }
  await outcome('callback_requested', 'call', 'followUpAt', tomorrow)
  check(Boolean((await record(lead.id)).lead.nextFollowUpAt))
  await outcome('meeting_booked', 'stage_update', 'meetingAt', tomorrow)
  check((await record(lead.id)).lead.contactStatus === 'meeting_booked')
  await outcome('won', 'stage_update', 'valueDollars', '2500.01')
  check((await record(lead.id)).lead.wonValueCents === 250001)
  check((await record(lead.id)).lead.nextFollowUpAt === null)
  await page.getByRole('button', { name: 'Reopen opportunity', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Reason for reopening')
    .fill('Browser integration review of audited reopening.')
  await page.getByRole('dialog').getByRole('button', { name: 'Reopen opportunity', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await outcome('do_not_call', 'stage_update')
  check(await page.getByRole('button', { name: 'Record outcome', exact: true }).isDisabled())
  check((await page.getByRole('button', { name: 'Reopen opportunity', exact: true }).count()) === 0)
  await page.getByRole('button', { name: /^Designs/ }).click()
  check((await page.locator('.crm-concept').count()) === 3)
  check(await page.getByRole('button', { name: 'Review and approve', exact: true }).first().isDisabled())
  await page.getByLabel('Enable prospect link').check()
  await page.getByRole('status').filter({ hasText: 'Prospect link enabled.' }).waitFor()
  check((await record(lead.id)).lead.designSharingEnabled === true)
  await page.getByLabel('Enable prospect link').uncheck()
  await page.getByRole('status').filter({ hasText: 'Prospect link disabled.' }).waitFor()
  await page.getByRole('link', { name: 'Leads', exact: true }).click()
  await page.getByRole('heading', { name: 'Business directory' }).waitFor()
  check(!(await page.locator('tbody').textContent()).includes(lead.businessName))
  await page.getByLabel('Demo records only').check()
  await page.getByRole('heading', { name: 'Business directory' }).waitFor()
  await page.getByLabel('Find a business').fill(lead.businessName)
  await page.getByRole('button', { name: 'Search leads' }).click()
  await page.locator('tbody').getByRole('link', { name: lead.businessName, exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1)
  check((await page.locator('tbody tr').count()) === 1)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 })
    for (const [slug, url] of [
      ['overview', '/crm'],
      ['leads', '/crm/leads'],
      ['detail', `/crm/leads/${lead.id}`],
      ['analytics', '/crm/analytics'],
    ]) {
      await go(url)
      await page.locator('h1').waitFor()
      await page.locator('.crm-loading').waitFor({ state: 'hidden' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
      check(!overflow)
      await page.screenshot({ path: path.join(output, `${slug}-${width}.png`), fullPage: true })
      observations.push({ view: slug, width, horizontalOverflow: overflow })
    }
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Know what’s moving forward.' }).waitFor()
  check((await page.getByRole('button', { name: 'Sign out' }).count()) === 1)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('heading', { name: 'Sign in to your workspace' }).waitFor()
  check(await page.evaluate(() => sessionStorage.getItem('sixsummit.crm.session') === null))
  const own = await crm.create('six_leads', {
    ...base,
    ...newDesignShare(target.origin),
    designSharingEnabled: false,
    businessName: 'Caller access demonstration',
    fingerprint: `frontend:caller:${key}`,
  })
  const other = await crm.create('six_leads', {
    ...base,
    ...newDesignShare(target.origin),
    designSharingEnabled: false,
    businessName: 'Restricted business demonstration',
    fingerprint: `frontend:restricted:${key}`,
  })
  await api('assign', { leadId: own.id, userId: staff.id })
  await api('assign', { leadId: other.id, userId: root.id })
  await go('/crm')
  await login(staff.username, password)
  check((await page.getByRole('link', { name: /NocoBase administration/ }).count()) === 0)
  await go(`/crm/leads/${own.id}`)
  await page.getByRole('heading', { name: own.businessName, exact: true }).waitFor()
  check((await page.getByLabel('Add a note', { exact: true }).count()) === 1)
  await go(`/crm/leads/${other.id}`)
  await page.getByRole('alert').waitFor()
  check((await page.getByRole('heading', { name: other.businessName, exact: true }).count()) === 0)
  await go('/crm/leads')
  await page.getByRole('heading', { name: 'Business directory' }).waitFor()
  check((await page.getByLabel('Demo records only').count()) === 0)
  await page.evaluate(() => {
    sessionStorage.setItem(
      'sixsummit.crm.session',
      JSON.stringify({ token: 'expired-test-token', role: 'sixsummit_caller' }),
    )
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Sign in to your workspace' }).waitFor()
  check((await page.locator('tbody').count()) === 0)
  check((await page.request.get(target.href)).status() === 200)
  check((await page.request.get(new URL('/crm/admin/sixsummit', target).href)).status() === 200)
  check(
    [401, 403].includes((await page.request.get(new URL('/crm/api/six_crm:leads', target).href)).status()),
  )
  assert.deepEqual((await crm.request('six_crm', 'summary')).data.metrics, originalMetrics)
  checks++
  assert.deepEqual(errors, [])
  checks++
  await writeFile(
    path.join(output, 'findings.json'),
    JSON.stringify({ ok: true, checks, observations, errors }, null, 2),
  )
  console.log(
    JSON.stringify({
      ok: true,
      checks,
      viewports: [320, 390, 768, 1440],
      screenshots: output,
      fixtureLeadId: lead.id,
      realMetricsUnchanged: true,
    }),
  )
} catch (error) {
  console.error(safe(error.stack || error.message))
  process.exitCode = 1
} finally {
  await browser?.close()
  if (staff)
    await crm.request('users', 'destroy', { query: { filterByTk: staff.id }, body: {} }).catch(() => {
      console.error('Could not remove the temporary caller account.')
      process.exitCode = 1
    })
}
