import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { prepareConcept, renderConcept } from '../src/designer.mjs'
import { memoryStore } from './helpers/object-store.mjs'
import { uploadConcept } from '../src/design-artifacts.mjs'

const job = { jobKey: '1:1:1', briefVersion: 1, conceptNumber: 1, direction: 'Brand-led', brief: { businessName: 'Fictional business', requiredPalette: ['#123456'] } }

test('freeform handoff preserves the original logo bytes and observed palette', async () => {
  const backendRoot = await mkdtemp(path.join(os.tmpdir(), 'sixsummit-design-'))
  try {
    await mkdir(path.join(backendRoot, 'originals'))
    const logo = '<svg xmlns="http://www.w3.org/2000/svg"><title>Original business logo</title></svg>'
    await writeFile(path.join(backendRoot, 'originals/logo.svg'), logo)
    const prepared = await prepareConcept({ ...job, brief: { ...job.brief, originalLogoPath: 'originals/logo.svg' } }, { id: 1 }, { backendRoot, env: { DESIGN_WORK_ROOT: path.join(backendRoot, "../", path.basename(backendRoot) + "-work") } })
    assert.equal(await readFile(path.join(prepared.source, prepared.brief.originalLogoPath), 'utf8'), logo)
    assert.deepEqual(prepared.brief.requiredPalette, ['#123456'])
    assert.equal(JSON.parse(await readFile(path.join(prepared.folder, 'brief.json'), 'utf8')).authoringMode, 'asa-freeform-v5')
    await assert.rejects(() => renderConcept(job, { id: 1 }, { backendRoot, env: { DESIGN_WORK_ROOT: path.join(backendRoot, "../", path.basename(backendRoot) + "-work") } }), { code: 'AWAITING_ASA_AUTHOR' })
  } finally { await rm(backendRoot, { recursive: true, force: true }); await rm(backendRoot + '-work', { recursive: true, force: true }) }
})

test('invalid job paths cannot write outside the private concept folder', async () => {
  const options = { backendRoot: os.tmpdir(), env: {} }
  await assert.rejects(() => prepareConcept(job, { id: '../../elsewhere' }, options), /Invalid design job/)
  await assert.rejects(() => prepareConcept({ ...job, briefVersion: -1 }, { id: 1 }, options), /Invalid design job/)
})

test('S3 original logos are preserved and generated work cannot be configured inside the checkout', async () => {
  const backendRoot = await mkdtemp(path.join(os.tmpdir(), 'sixsummit-remote-logo-'))
  const store = memoryStore()
  const logoKey = 'brands/lead-1/original.svg'
  await store.put(logoKey, Buffer.from('<svg>Original identity</svg>'))
  const remoteJob = { ...job, brief: { ...job.brief, originalLogoPath: store.uri(logoKey) } }
  const options = { backendRoot, env: { DESIGN_WORK_ROOT: backendRoot }, store }
  try {
    const prepared = await prepareConcept(remoteJob, { id: 1 }, options)
    assert.equal(await readFile(path.join(prepared.source, 'assets/original-logo.svg'), 'utf8'), '<svg>Original identity</svg>')
    await mkdir(path.join(prepared.folder, 'review'))
    for (const name of ['wide.png', 'narrow.png']) await writeFile(path.join(prepared.folder, 'review', name), 'capture')
    await writeFile(path.join(prepared.folder, 'review/findings.json'), '{"ok":true,"findingCount":0}')
    await writeFile(path.join(prepared.source, 'index.html'), '<h1>Concept</h1>')
    await writeFile(path.join(prepared.source, 'assets/original-logo.svg'), 'Changed original logo')
    await assert.rejects(() => uploadConcept(store, prepared.folder, remoteJob, { id: 1 }), /logo was modified/)
    const checkout = new URL('../../', import.meta.url).pathname
    await assert.rejects(() => prepareConcept(job, { id: 1 }, { ...options, env: { DESIGN_WORK_ROOT: path.join(checkout, 'backend/storage/new-designs') } }), /outside the codebase/)
  } finally { await rm(backendRoot, { recursive: true, force: true }) }
})
