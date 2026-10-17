import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { newDesignShare, ensureDesignShare, publishReviewedDesigns, prospectGallery, prospectFile } from '../src/design-sharing.mjs'
import { prospectHandler } from '../src/prospect-http.mjs'

async function fixture() {
  const backendRoot = await mkdtemp(path.join(os.tmpdir(), 'sixsummit-share-'))
  const folder = path.join(backendRoot, 'storage/concepts/lead-7/v1/concept-1')
  await mkdir(path.join(folder, 'authored/assets'), { recursive: true })
  await mkdir(path.join(folder, 'review'))
  await writeFile(path.join(folder, 'authored/index.html'), '<h1>Reviewed concept</h1>')
  await writeFile(path.join(folder, 'authored/assets/logo.svg'), '<svg/>')
  await writeFile(path.join(folder, 'authored/AUTHORING.txt'), 'Private author instructions')
  await writeFile(path.join(folder, 'brief.json'), 'Private call notes')
  await writeFile(path.join(folder, 'review/wide.png'), 'test capture')
  await writeFile(path.join(folder, 'review/narrow.png'), 'test capture')
  const lead = { id: 7, businessName: 'Fictional business', city: 'Regina', briefVersion: 1, businessNotes: 'Do not expose', ...newDesignShare('https://studio.example') }
  const job = { id: 9, leadId: 7, briefVersion: 1, conceptNumber: 1, direction: 'Brand continuity', status: 'needs_review', htmlPath: path.relative(backendRoot, path.join(folder, 'authored/index.html')), desktopPath: path.relative(backendRoot, path.join(folder, 'review/wide.png')), mobilePath: path.relative(backendRoot, path.join(folder, 'review/narrow.png')) }
  const crm = {
    async list(table, filter = {}) { return [table === 'six_leads' ? lead : job].filter(row => Object.entries(filter).every(([key,value]) => row[key] === value)) },
    async update(table, id, values) { Object.assign(table === 'six_leads' ? lead : job, values) },
  }
  return { backendRoot, lead, job, crm, folder, options: { backendRoot, publicSiteUrl: 'https://studio.example' } }
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
    const html = await prospectFile(f.backendRoot, f.lead, [f.job], 1, 'files/index.html')
    await writeFile(path.join(f.folder, 'authored/index.html'), 'UNREVIEWED EDIT')
    assert.equal((await publishReviewedDesigns(f.crm, f.options)).published, 0)
    assert.equal(await readFile(html, 'utf8'), '<h1>Reviewed concept</h1>')
    assert.equal(await prospectFile(f.backendRoot, f.lead, [f.job], 1, 'files/AUTHORING.txt'), null)
    const gallery = prospectGallery(f.lead, [f.job])
    assert.deepEqual(Object.keys(gallery).sort(), ['businessName', 'city', 'concepts'])
    assert.equal(gallery.concepts[1].ready, false)
    assert.doesNotMatch(JSON.stringify(gallery), /businessNotes|htmlPath|caller|Do not expose/)
    await assert.rejects(() => prospectFile(f.backendRoot, f.lead, [f.job], 1, 'files/../../../../concepts/lead-7/v1/concept-1/authored/index.html'))
    f.lead.designSharingEnabled = false
    assert.equal(prospectGallery(f.lead, [f.job]), null)
    assert.equal(await prospectFile(f.backendRoot, f.lead, [f.job], 1, 'files/index.html'), null)
  } finally { await rm(f.backendRoot, { recursive: true, force: true }) }
})

test('publication rejects other leads, outside screenshots and symlinks', async () => {
  for (const attack of ['other-lead', 'outside-screenshot', 'symlink']) {
    const f = await fixture()
    try {
      f.job.status = 'ready'
      if (attack === 'other-lead') f.lead.id = 8
      if (attack === 'outside-screenshot') { await writeFile(path.join(f.backendRoot, 'secret.png'), 'secret'); f.job.desktopPath = 'secret.png' }
      if (attack === 'symlink') await symlink(path.join(f.folder, 'brief.json'), path.join(f.folder, 'authored/assets/private.js'))
      const result = await publishReviewedDesigns(f.crm, f.options)
      assert.equal(result.published, 0)
      assert.equal(f.job.publicationKey, undefined)
    } finally { await rm(f.backendRoot, { recursive: true, force: true }) }
  }
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
