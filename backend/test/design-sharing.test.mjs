import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { newDesignShare, ensureDesignShare, publishReviewedDesigns, prospectGallery, prospectFile } from '../src/design-sharing.mjs'
import { uploadConcept, restoreConcept } from '../src/design-artifacts.mjs'
import { memoryStore } from './helpers/object-store.mjs'
import { prospectHandler } from '../src/prospect-http.mjs'
import { previewFrameTag } from '../src/preview-frame.mjs'

async function fixture() {
  const backendRoot = await mkdtemp(path.join(os.tmpdir(), 'sixsummit-share-'))
  const folder = path.join(backendRoot, 'scratch')
  await mkdir(path.join(folder, 'authored/assets'), { recursive: true })
  await mkdir(path.join(folder, 'review'))
  await writeFile(path.join(folder, 'authored/index.html'), '<h1>Reviewed concept</h1>')
  await writeFile(path.join(folder, 'authored/assets/logo.svg'), '<svg/>')
  await writeFile(path.join(folder, 'authored/app.js'), 'document.body.dataset.interactive = "yes"')
  await writeFile(path.join(folder, 'authored/styles.css'), 'body { color: #123456; }')
  await writeFile(path.join(folder, 'authored/AUTHORING.txt'), 'Private author instructions')
  await writeFile(path.join(folder, 'brief.json'), 'Private call notes')
  await writeFile(path.join(folder, 'review/wide.png'), 'test capture')
  await writeFile(path.join(folder, 'review/narrow.png'), 'test capture')
  await writeFile(path.join(folder, 'review/findings.json'), JSON.stringify({ ok: true, findingCount: 0 }))
  await writeFile(path.join(folder, 'authored/identity.vectorcraft'), 'Editable identity master')
  const lead = { id: 7, businessName: 'Fictional business', city: 'Regina', briefVersion: 1, businessNotes: 'Do not expose', ...newDesignShare('https://studio.example') }
  const job = { id: 9, leadId: 7, briefVersion: 1, conceptNumber: 1, direction: 'Brand continuity', status: 'needs_review', htmlPath: path.relative(backendRoot, path.join(folder, 'authored/index.html')), desktopPath: path.relative(backendRoot, path.join(folder, 'review/wide.png')), mobilePath: path.relative(backendRoot, path.join(folder, 'review/narrow.png')) }
  const crm = {
    async list(table, filter = {}) { return [table === 'six_leads' ? lead : job].filter(row => Object.entries(filter).every(([key,value]) => row[key] === value)) },
    async update(table, id, values) { Object.assign(table === 'six_leads' ? lead : job, values) },
  }
  const store = memoryStore()
  Object.assign(job, await uploadConcept(store, folder, job, lead))
  return { backendRoot, lead, job, crm, folder, store, options: { store, publicSiteUrl: 'https://studio.example' } }
}

test('links use opaque tokens, preserve revocation, and can change origin without changing identity', async () => {
  const lead = { id: 1, ...newDesignShare('https://studio.example'), designSharingEnabled: false }
  const token = lead.designShareToken
  await ensureDesignShare({ update: async () => {} }, lead, { publicSiteUrl: 'https://new.example' })
  assert.equal(lead.designShareToken, token)
  assert.equal(lead.designShareUrl, `https://new.example/designs/${token}`)
  assert.equal(lead.designSharingEnabled, false)
  assert.notEqual(newDesignShare().designShareToken, token)
  assert.throws(() => newDesignShare('https://user:secret@example.com'), /origin/)
})

test('only approved concepts publish, snapshots are immutable and public metadata excludes CRM research', async () => {
  const f = await fixture()
  try {
    assert.equal((await publishReviewedDesigns(f.crm, f.options)).published, 0)
    assert.equal(prospectGallery(f.lead, [f.job]).concepts[0].ready, false)
    f.job.status = 'ready'
    assert.equal((await publishReviewedDesigns(f.crm, f.options)).published, 1)
    const html = await prospectFile(f.store, f.lead, [f.job], 1, 'files/index.html')
    await writeFile(path.join(f.folder, 'authored/index.html'), 'UNREVIEWED EDIT')
    assert.equal((await publishReviewedDesigns(f.crm, f.options)).published, 0)
    let content = ''; for await (const bytes of html.body) content += bytes
    assert.equal(content, '<h1>Reviewed concept</h1>')
    assert.ok([...f.store.objects.keys()].some(key => key.startsWith('drafts/') && key.endsWith('identity.vectorcraft')))
    assert.ok(![...f.store.objects.keys()].some(key => key.startsWith('published/') && /AUTHORING|brief|vectorcraft/.test(key)))
    assert.equal(await prospectFile(f.store, f.lead, [f.job], 1, 'files/AUTHORING.txt'), null)
    const gallery = prospectGallery(f.lead, [f.job])
    assert.deepEqual(Object.keys(gallery).sort(), ['businessName', 'city', 'concepts'])
    assert.equal(gallery.concepts[1].ready, false)
    assert.doesNotMatch(JSON.stringify(gallery), /businessNotes|htmlPath|caller|Do not expose/)
    assert.equal(await prospectFile(f.store, f.lead, [f.job], 1, 'files/../../../../concepts/lead-7/v1/concept-1/authored/index.html'), null)
    f.lead.designSharingEnabled = false
    assert.equal(prospectGallery(f.lead, [f.job]), null)
    assert.equal(await prospectFile(f.store, f.lead, [f.job], 1, 'files/index.html'), null)
  } finally { await rm(f.backendRoot, { recursive: true, force: true }) }
})

test('publication rejects another lead and failed uploads never produce a CRM publication', async () => {
  const f = await fixture()
  try {
    f.job.status = 'ready'
    f.lead.id = 8
    f.job.leadId = 8
    assert.equal((await publishReviewedDesigns(f.crm, f.options)).failed, 1)
    assert.equal(f.job.publicationKey, undefined)
    f.lead.id = 7
    f.job.leadId = 7
    f.store.put = async () => { throw new Error('Provider unavailable') }
    assert.equal((await publishReviewedDesigns(f.crm, f.options)).failed, 1)
    assert.equal(f.job.publicationKey, undefined)
  } finally { await rm(f.backendRoot, { recursive: true, force: true }) }
})

test('private bundles restore masters and reviews without the original local working files', async () => {
  const f = await fixture()
  try {
    await rm(f.folder, { recursive: true })
    const restored = path.join(f.backendRoot, 'restored')
    await restoreConcept(f.store, f.job.artifactManifest, restored, f.job, f.lead)
    assert.equal(await readFile(path.join(restored, 'authored/identity.vectorcraft'), 'utf8'), 'Editable identity master')
    assert.equal(await readFile(path.join(restored, 'authored/AUTHORING.txt'), 'utf8'), 'Private author instructions')
    f.job.status = 'ready'
    assert.equal((await publishReviewedDesigns(f.crm, f.options)).published, 1)
    await assert.rejects(() => restoreConcept(f.store, f.job.artifactManifest, restored, f.job, f.lead), /empty/)
  } finally { await rm(f.backendRoot, { recursive: true, force: true }) }
})

test('upload rejects symlinks and failed browser findings, and publishes the manifest last', async () => {
  const f = await fixture()
  try {
    await symlink(path.join(f.folder, 'brief.json'), path.join(f.folder, 'authored/assets/private.js'))
    await assert.rejects(() => uploadConcept(f.store, f.folder, f.job, f.lead), /symbolic/)
    await rm(path.join(f.folder, 'authored/assets/private.js'))
    await writeFile(path.join(f.folder, 'review/findings.json'), '{"ok":false,"findingCount":1}')
    await assert.rejects(() => uploadConcept(f.store, f.folder, f.job, f.lead), /browser checks/)
    await writeFile(path.join(f.folder, 'review/findings.json'), '{"ok":true,"findingCount":0}')
    const written = []
    f.store.put = async key => { written.push(key); if (key.endsWith('wide.png')) throw new Error('Network failure') }
    await assert.rejects(() => uploadConcept(f.store, f.folder, f.job, f.lead), /Network failure/)
    assert.ok(!written.some(key => key.endsWith('/manifest.json')))
  } finally { await rm(f.backendRoot, { recursive: true, force: true }) }
})

test('anonymous gallery access requires the exact active token and never accepts writes', async () => {
  const f = await fixture()
  try {
    const request = async (url, method = 'GET') => {
      const headers = {}
      const res = { setHeader(key,value) { headers[key] = value }, writeHead(status, extra) { this.status = status; Object.assign(headers, extra) }, end(body) { this.body = JSON.parse(body) } }
      await prospectHandler(f)({ url, method }, res)
      return { ...res, headers }
    }
    const address = `/prospect-api/designs/${f.lead.designShareToken}`
    assert.equal((await request(address)).status, 200)
    assert.equal((await request(address, 'POST')).status, 405)
    assert.equal((await request('/prospect-api/designs/7')).status, 404)
    assert.equal((await request(address.replace(/.$/, 'Z'))).status, 404)
    f.lead.designSharingEnabled = false
    assert.equal((await request(address)).status, 404)
  } finally { await rm(f.backendRoot, { recursive: true, force: true }) }
})

test('approved S3 assets stream through the website sandbox and revocation blocks later requests', async () => {
  const f = await fixture()
  const server = createServer(prospectHandler(f))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    f.job.status = 'ready'
    await publishReviewedDesigns(f.crm, f.options)
    await rm(f.folder, { recursive: true })
    const base = `http://127.0.0.1:${server.address().port}/prospect-api/designs/${f.lead.designShareToken}`
    const address = `${base}/concepts/1/files/index.html`
    const response = await fetch(address)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), '<h1>Reviewed concept</h1>' + previewFrameTag.toString())
    assert.match(response.headers.get('content-security-policy'), /sandbox allow-scripts;/)
    assert.doesNotMatch(response.headers.get('content-security-policy'), /allow-same-origin/)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.match(response.headers.get('x-robots-tag'), /noindex/)
    const head = await fetch(address, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')
    assert.equal((await fetch(`${base}/concepts/1/files/identity.vectorcraft`)).status, 404)
    f.lead.designSharingEnabled = false
    assert.equal((await fetch(address)).status, 404)
    assert.equal((await fetch(base)).status, 404)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await rm(f.backendRoot, { recursive: true, force: true })
  }
})

test('draft checksum corruption blocks publication and legacy local snapshots remain unavailable', async () => {
  const f = await fixture()
  try {
    f.job.status = 'ready'
    f.job.publicationKey = 'a'.repeat(48)
    assert.equal(prospectGallery(f.lead, [f.job]).concepts[0].ready, false)
    f.store.objects.set(f.store.key(f.job.htmlPath), Buffer.from('tampered bytes'))
    assert.equal((await publishReviewedDesigns(f.crm, f.options)).failed, 1)
    assert.equal(f.job.publicationManifest, undefined)
  } finally { await rm(f.backendRoot, { recursive: true, force: true }) }
})

test('private draft captures require the staff token and live row access, even before publication', async () => {
  const f = await fixture()
  let revoked = false
  const staffDetail = async (token, role, leadId) => {
    if (token !== 'test-staff-token') throw Object.assign(new Error('Denied'), { status: 401 })
    if (revoked || role !== 'sixsummit_caller') throw Object.assign(new Error('Denied'), { status: 403 })
    if (leadId !== f.lead.id) throw Object.assign(new Error('Missing'), { status: 404 })
    return { lead: f.lead, concepts: [f.job] }
  }
  const server = createServer(prospectHandler({ ...f, staffDetail }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const url = `${base}/prospect-api/staff/leads/7/concepts/9/desktop.png`
    const headers = { Authorization: 'Bearer test-staff-token', 'X-Role': 'sixsummit_caller' }
    assert.equal((await fetch(url)).status, 401)
    const capture = await fetch(url, { headers })
    assert.equal(capture.status, 200)
    assert.equal(capture.headers.get('content-type'), 'image/png')
    assert.equal(capture.headers.get('cache-control'), 'no-store')
    assert.equal(capture.headers.get('access-control-allow-origin'), null)
    assert.equal(await capture.text(), 'test capture')
    const publicPreview = await fetch(`${base}/prospect-api/designs/${f.lead.designShareToken}/concepts/1/desktop.png`)
    assert.equal(publicPreview.status, 404)
    assert.equal((await fetch(url.replace('desktop.png', 'brief.json'), { headers })).status, 404)
    assert.equal((await fetch(url.replace('/concepts/9/', '/concepts/10/'), { headers })).status, 404)
    revoked = true
    assert.equal((await fetch(url, { headers })).status, 403)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await rm(f.backendRoot, { recursive: true, force: true })
  }
})

test('live draft previews serve only scoped authored files without publishing or exposing staff credentials', async () => {
  const f = await fixture()
  let revoked = false
  let time = 0
  const staffDetail = async (token, role, leadId) => {
    if (token !== 'private-staff-token') throw Object.assign(new Error('Denied'), { status: 401 })
    if (revoked || role !== 'sixsummit_caller') throw Object.assign(new Error('Denied'), { status: 403 })
    if (leadId !== f.lead.id) throw Object.assign(new Error('Missing'), { status: 404 })
    return { lead: f.lead, concepts: [f.job] }
  }
  const server = createServer(prospectHandler({ ...f, staffDetail, previewOptions: { now: () => time, ttlMs: 1000 } }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const issue = `${base}/prospect-api/staff/leads/7/concepts/9/preview`
    const headers = { Authorization: 'Bearer private-staff-token', 'X-Role': 'sixsummit_caller' }
    assert.equal((await fetch(issue, { method: 'POST' })).status, 401)
    assert.equal((await fetch(issue, { headers })).status, 405)
    assert.equal((await fetch(issue.replace('/9/', '/10/'), { method: 'POST', headers })).status, 404)
    const response = await fetch(issue, { method: 'POST', headers })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), null)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const preview = await response.json()
    assert.doesNotMatch(JSON.stringify(preview), /private-staff-token|artifactManifest|s3:/)
    const url = base + preview.siteUrl
    const html = await fetch(url)
    assert.equal(html.status, 200)
    assert.equal(await html.text(), '<h1>Reviewed concept</h1>' + previewFrameTag.toString())
    assert.match(html.headers.get('content-type'), /text\/html/)
    assert.match(html.headers.get('content-security-policy'), /sandbox allow-scripts;/)
    assert.doesNotMatch(html.headers.get('content-security-policy'), /allow-same-origin/)
    assert.match(html.headers.get('content-security-policy'), /connect-src 'none'/)
    assert.equal((await fetch(url, { method: 'HEAD' })).status, 200)
    assert.equal(await (await fetch(url, { method: 'HEAD' })).text(), '')
    for (const [name, type] of [['app.js', 'text/javascript'], ['styles.css', 'text/css'], ['assets/logo.svg', 'image/svg+xml']]) {
      const asset = await fetch(url.replace('index.html', name))
      assert.equal(asset.status, 200)
      assert.equal(asset.headers.get('content-type'), type)
    }
    for (const name of ['AUTHORING.txt', 'identity.vectorcraft', 'brief.json', 'review/wide.png'])
      assert.equal((await fetch(url.replace('index.html', name))).status, 404)
    assert.equal((await fetch(url, { method: 'POST' })).status, 405)
    assert.equal((await fetch(`${base}/prospect-api/designs/${f.lead.designShareToken}/concepts/1/files/index.html`)).status, 404)
    assert.equal(f.job.status, 'needs_review')
    assert.equal(f.job.publicationManifest, undefined)
    revoked = true
    assert.equal((await fetch(url.replace('index.html', 'app.js'))).status, 403)
    revoked = false
    const next = await (await fetch(issue, { method: 'POST', headers })).json()
    time = 1001
    assert.equal((await fetch(base + next.siteUrl)).status, 404)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await rm(f.backendRoot, { recursive: true, force: true })
  }
})
