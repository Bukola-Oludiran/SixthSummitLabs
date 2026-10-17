import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { prepareConcept, renderConcept } from '../src/designer.mjs'

const job = { jobKey: '1:1:1', briefVersion: 1, conceptNumber: 1, direction: 'Brand-led', brief: { businessName: 'Fictional business', requiredPalette: ['#123456'] } }

test('freeform handoff preserves the original logo bytes and observed palette', async () => {
  const backendRoot = await mkdtemp(path.join(os.tmpdir(), 'sixsummit-design-'))
  try {
    await mkdir(path.join(backendRoot, 'originals'))
    const logo = '<svg xmlns="http://www.w3.org/2000/svg"><title>Original business logo</title></svg>'
    await writeFile(path.join(backendRoot, 'originals/logo.svg'), logo)
    const prepared = await prepareConcept({ ...job, brief: { ...job.brief, originalLogoPath: 'originals/logo.svg' } }, { id: 1 }, { backendRoot, env: {} })
    assert.equal(await readFile(path.join(prepared.source, prepared.brief.originalLogoPath), 'utf8'), logo)
    assert.deepEqual(prepared.brief.requiredPalette, ['#123456'])
    assert.equal(JSON.parse(await readFile(path.join(prepared.folder, 'brief.json'), 'utf8')).authoringMode, 'asa-freeform-v5')
    await assert.rejects(() => renderConcept(job, { id: 1 }, { backendRoot, env: {} }), { code: 'AWAITING_ASA_AUTHOR' })
  } finally { await rm(backendRoot, { recursive: true, force: true }) }
})

test('invalid job paths cannot write outside the private concept folder', async () => {
  const options = { backendRoot: os.tmpdir(), env: {} }
  await assert.rejects(() => prepareConcept(job, { id: '../../elsewhere' }, options), /Invalid design job/)
  await assert.rejects(() => prepareConcept({ ...job, briefVersion: -1 }, { id: 1 }, options), /Invalid design job/)
})
