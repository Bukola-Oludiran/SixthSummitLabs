// Self-contained fixture test: never loads .env or contacts production CRM/R2.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { uploadConcept } from '../src/design-artifacts.mjs'
import { newDesignShare, publishReviewedDesigns } from '../src/design-sharing.mjs'
import { prospectHandler } from '../src/prospect-http.mjs'
import { memoryStore } from '../test/helpers/object-store.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const dist = path.join(root, 'dist')
await readFile(path.join(dist, 'index.html')) // npm run build first.
const output = await mkdtemp(path.join(os.tmpdir(), 'sixsummit-live-previews-'))
const folder = path.join(output, 'fixture')
await mkdir(path.join(folder, 'authored/assets'), { recursive: true })
await mkdir(path.join(folder, 'review'))
await writeFile(path.join(folder, 'authored/index.html'), '<!doctype html><html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="style.css"><h1>Interactive concept fixture</h1><img src="assets/art.svg" alt="Illustrative fixture"><button id="interact">Try interaction</button><p id="result">Waiting</p><script type="module" src="app.js"></script></html>')
await writeFile(path.join(folder, 'authored/style.css'), 'body{background:#f4eee4;color:#242121;font:22px system-ui;padding:24px}img{display:block;width:160px;height:120px}button{padding:16px;font:inherit}')
await writeFile(path.join(folder, 'authored/assets/art.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#2563ff"/></svg>')
await writeFile(path.join(folder, 'authored/message.js'), 'export const message = "Interaction works";')
await writeFile(path.join(folder, 'authored/app.js'), `import {message} from './message.js';
document.querySelector('#interact').onclick=()=>document.querySelector('#result').textContent=message;
try{parent.sessionStorage.getItem('sixsummit.crm.session');document.body.dataset.isolated='no'}catch{document.body.dataset.isolated='yes'}
fetch('/crm/api/auth:check').then(()=>document.body.dataset.blocked='no').catch(()=>document.body.dataset.blocked='yes');`)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1kAAAAASUVORK5CYII=', 'base64')
for (const name of ['wide.png', 'narrow.png']) await writeFile(path.join(folder, 'review', name), png)
await writeFile(path.join(folder, 'review/findings.json'), '{"ok":true,"findingCount":0}')
const lead = { id: 1, businessName: 'Private preview fixture', city: 'Regina', province: 'SK', category: 'Test fixture', phone: '+13065550101', isDemo: true, contactStatus: 'new', briefVersion: 1, assignedToUserId: 1, designStatus: 'needs_review', ...newDesignShare('https://fixture.invalid') }
const job = { id: 1, leadId: 1, conceptNumber: 1, briefVersion: 1, status: 'needs_review', direction: 'Interactive fixture' }
const store = memoryStore()
Object.assign(job, await uploadConcept(store, folder, job, lead))
const crm = {
  async list(table, filter = {}) { return [table === 'six_leads' ? lead : job].filter(row => Object.entries(filter).every(([key, value]) => row[key] === value)) },
  async update(table, id, values) { Object.assign(table === 'six_leads' ? lead : job, values) },
}
const token = 'fixture-staff-token-never-production'
const user = { id: 1, username: 'fixture', nickname: 'Preview reviewer', roles: [{ name: 'root' }] }
let authenticatedAssetReads = 0
const prospect = prospectHandler({ crm, store, staffDetail: async (credential, role, id) => {
  assert.equal(credential, token); assert.equal(role, 'root'); assert.equal(id, 1)
  authenticatedAssetReads++
  return { lead, concepts: [job] }
} })
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname.startsWith('/prospect-api/')) return prospect(req, res)
  if (url.pathname.startsWith('/crm/api/')) {
    if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(401).end(); return }
    const action = url.pathname.split(':')[1]
    const data = url.pathname.includes('/auth:') ? user : action === 'detail' ? { lead, concepts: [job], activities: [], sources: [] } : action === 'callers' ? [user] : []
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data })); return
  }
  try {
    const filename = url.pathname.startsWith('/assets/') ? url.pathname.slice(1) : 'index.html'
    const target = path.resolve(dist, filename)
    if (!target.startsWith(dist + path.sep)) { res.writeHead(404).end(); return }
    const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' }[path.extname(target)] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type }).end(await readFile(target))
  } catch { res.writeHead(404).end() }
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const origin = `http://127.0.0.1:${server.address().port}`
const asa = process.env.ASA_DIR || path.join(os.homedir(), 'Desktop/Jays-Lab/ASA-UI-UX')
const { chromium } = createRequire(path.join(asa, 'package.json'))('playwright')
const browser = await chromium.launch({ headless: true })
const checks = []
const errors = []
const check = (condition, label) => { assert.ok(condition, label); checks.push(label) }
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(session => { if (window === top) sessionStorage.setItem('sixsummit.crm.session', JSON.stringify(session)) }, { token, role: 'root' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin + '/crm/leads/1')
  await page.getByRole('button', { name: /^Designs/ }).click()
  const frame = page.frameLocator('.website-preview-screen iframe')
  await frame.getByRole('button', { name: 'Try interaction' }).click()
  check(await frame.locator('#result').innerText() === 'Interaction works', 'CRM draft runs local JavaScript modules')
  check(await frame.locator('body').getAttribute('data-isolated') === 'yes', 'draft cannot read CRM session storage')
  await frame.locator('body[data-blocked="yes"]').waitFor()
  checks.push('draft cannot fetch CRM APIs')
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('iframe').style.width === '390px')
  check(await frame.locator('html').evaluate(() => innerWidth) === 390, 'mobile mode changes the actual iframe viewport')
  await page.screenshot({ path: path.join(output, 'crm-live.png'), fullPage: true })
  await page.getByRole('button', { name: /Full screen/ }).click()
  const dialog = page.locator('.website-preview-dialog[open]')
  await dialog.waitFor()
  const expanded = dialog.frameLocator('iframe')
  await expanded.getByRole('button', { name: 'Try interaction' }).click()
  check(await expanded.locator('#result').innerText() === 'Interaction works', 'CRM full-screen website is interactive')
  check(await dialog.evaluate(el => Math.abs(el.getBoundingClientRect().width - innerWidth) < 2 && Math.abs(el.getBoundingClientRect().height - innerHeight) < 2), 'expanded preview fills the viewport')
  await dialog.getByRole('button', { name: 'Desktop', exact: true }).click()
  await page.screenshot({ path: path.join(output, 'crm-fullscreen.png') })
  await dialog.getByRole('button', { name: /Exit full screen/ }).click()
  await dialog.waitFor({ state: 'hidden' })
  check(await page.getByRole('button', { name: /Full screen/ }).evaluate(el => el === document.activeElement), 'closing restores focus to the opener')
  check(authenticatedAssetReads > 4, 'HTML and assets each recheck staff access')
  const unapproved = await (await fetch(origin + `/prospect-api/designs/${lead.designShareToken}`)).json()
  check(!unapproved.concepts[0].ready, 'private live review never publishes a draft')
  await context.close()

  job.status = 'ready'
  await publishReviewedDesigns(crm, { store, publicSiteUrl: origin })
  const client = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await client.addInitScript(() => { Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true }) })
  const prospectPage = await client.newPage()
  prospectPage.on('pageerror', error => errors.push(error.message))
  await prospectPage.goto(origin + `/designs/${lead.designShareToken}`)
  const clientFrame = prospectPage.frameLocator('.website-preview-screen iframe')
  await clientFrame.getByRole('button', { name: 'Try interaction' }).click()
  check(await clientFrame.locator('#result').innerText() === 'Interaction works', 'client gallery serves the live website')
  await prospectPage.getByRole('button', { name: 'Mobile', exact: true }).click()
  await prospectPage.getByRole('button', { name: /Full screen/ }).click()
  const clientDialog = prospectPage.locator('.website-preview-dialog[open]')
  await clientDialog.frameLocator('iframe').getByRole('button', { name: 'Try interaction' }).click()
  await prospectPage.evaluate(() => window.postMessage({ type: 'sixsummit-preview:escape' }, '*'))
  await prospectPage.waitForTimeout(50)
  check(await clientDialog.isVisible(), 'Escape relay ignores messages from unrelated windows')
  check(await clientDialog.evaluate(el => Math.abs(el.getBoundingClientRect().height - innerHeight) < 2), 'full-window fallback works without native fullscreen')
  await prospectPage.screenshot({ path: path.join(output, 'client-fullscreen-mobile.png') })
  await prospectPage.keyboard.press('Escape')
  await clientDialog.waitFor({ state: 'hidden' })
  checks.push('Escape closes the client expanded preview')
  for (const width of [320, 390, 768, 1440]) {
    await prospectPage.setViewportSize({ width, height: 900 })
    check(await prospectPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `client gallery has no overflow at ${width}px`)
  }
  await client.close()
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ ok: errors.length === 0, checks, errors }, null, 2))
  if (errors.length) console.error(JSON.stringify({ output, errors }))
  check(errors.length === 0, 'no browser runtime errors')
  console.log(JSON.stringify({ ok: true, checks: checks.length, output }))
} finally {
  await browser.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await rm(folder, { recursive: true, force: true })
}
