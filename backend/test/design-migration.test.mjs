import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { migrateLegacyDesigns } from '../src/design-migration.mjs'
import { prospectFile } from '../src/design-sharing.mjs'
import { memoryStore } from './helpers/object-store.mjs'

async function fixture() {
  const backendRoot = await mkdtemp(path.join(os.tmpdir(), 'sixsummit-legacy-'))
  const draft = path.join(backendRoot, 'storage/concepts/lead-7/v1/concept-1')
  const publicationKey = 'a'.repeat(48)
  const snapshot = path.join(backendRoot, 'storage/published', publicationKey)
  for (const folder of [path.join(draft, 'authored/assets'), path.join(draft, 'review'), path.join(snapshot, 'files/assets')]) await mkdir(folder, { recursive: true })
  await writeFile(path.join(draft, 'authored/index.html'), 'Later unapproved working edit')
  await writeFile(path.join(snapshot, 'files/index.html'), 'Previously approved snapshot')
  const logo = '<svg>Original logo bytes</svg>'
  await writeFile(path.join(backendRoot, 'storage/original.svg'), logo)
  for (const folder of [path.join(draft, 'authored/assets'), path.join(snapshot, 'files/assets')]) await writeFile(path.join(folder, 'original-logo.svg'), logo)
  await writeFile(path.join(draft, 'authored/identity.vectorcraft'), 'Editable master')
  for (const name of ['wide.png', 'narrow.png']) await writeFile(path.join(draft, 'review', name), 'capture')
  for (const name of ['desktop.png', 'mobile.png']) await writeFile(path.join(snapshot, name), 'approved capture')
  await writeFile(path.join(draft, 'review/findings.json'), '{"ok":true,"findingCount":0}')
  const lead = { id: 7, briefVersion: 1, designSharingEnabled: true, designShareToken: 't'.repeat(43), logoAssetPath: 'storage/original.svg' }
  const job = { id: 9, leadId: 7, briefVersion: 1, conceptNumber: 1, status: 'ready', htmlPath: 'storage/concepts/lead-7/v1/concept-1/authored/index.html', publicationKey, brief: { originalLogoPath: 'storage/original.svg' } }
  const crm = {
    async list(table, filter = {}) { return structuredClone([table === 'six_leads' ? lead : job].filter(row => Object.entries(filter).every(([key, value]) => row[key] === value))) },
    async update(table, id, values) { Object.assign(table === 'six_leads' ? lead : job, structuredClone(values)) },
  }
  return { backendRoot, draft, snapshot, lead, job, crm, store: memoryStore() }
}

test('migration preserves exact approved snapshots, uploads original logos, keeps local originals and reruns safely', async () => {
  const f = await fixture()
  try {
    assert.equal((await migrateLegacyDesigns(f.crm, f.store, f)).migrated, 1)
    assert.match(f.job.artifactManifest, /^s3:\/\//)
    assert.match(f.lead.logoAssetPath, /^s3:\/\//)
    assert.equal(f.job.brief.originalLogoPath, f.lead.logoAssetPath)
    const file = await prospectFile(f.store, f.lead, [f.job], 1, 'files/index.html')
    let content = ''; for await (const bytes of file.body) content += bytes
    assert.equal(content, 'Previously approved snapshot')
    assert.equal(await readFile(path.join(f.draft, 'authored/identity.vectorcraft'), 'utf8'), 'Editable master')
    assert.equal(await readFile(path.join(f.snapshot, 'files/index.html'), 'utf8'), 'Previously approved snapshot')
    const key = f.job.publicationKey
    assert.equal((await migrateLegacyDesigns(f.crm, f.store, f)).migrated, 0)
    assert.equal(f.job.publicationKey, key)
  } finally { await rm(f.backendRoot, { recursive: true, force: true }) }
})

test('a failed migration retains both the old CRM references and the only local copies', async () => {
  const f = await fixture()
  try {
    const put = f.store.put.bind(f.store)
    f.store.put = async (key, bytes) => { if (key.startsWith('published/')) throw new Error('Provider unavailable'); return put(key, bytes) }
    await assert.rejects(() => migrateLegacyDesigns(f.crm, f.store, f), /Provider unavailable/)
    assert.equal(f.job.artifactManifest, undefined)
    assert.equal(f.job.publicationManifest, undefined)
    assert.equal(f.lead.logoAssetPath, 'storage/original.svg')
    assert.equal(await readFile(path.join(f.snapshot, 'files/index.html'), 'utf8'), 'Previously approved snapshot')
  } finally { await rm(f.backendRoot, { recursive: true, force: true }) }
})
