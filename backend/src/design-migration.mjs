import { randomBytes } from 'node:crypto'
import { realpath, readFile, mkdtemp, cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { uploadConcept, publishConcept } from './design-artifacts.mjs'

// Originals are retained until an operator verifies the remote copies.
export async function migrateLegacyDesigns(crm, store, { backendRoot }) {
  const jobs = await crm.list('six_concepts', {}, { paginate: false })
  let migrated = 0
  for (const job of jobs) {
    if (job.artifactManifest || !job.htmlPath || job.htmlPath.startsWith('s3://')) continue
    const [lead] = await crm.list('six_leads', { id: job.leadId })
    if (!lead) throw new Error('Migration lead not found.')
    const legacy = path.join(backendRoot, 'storage/concepts', `lead-${lead.id}`, `v${job.briefVersion}`, `concept-${job.conceptNumber}`)
    const html = await realpath(path.resolve(backendRoot, job.htmlPath))
    if (html !== path.join(await realpath(legacy), 'authored/index.html')) throw new Error('Legacy design belongs to another lead or version.')
    const originalPath = job.brief?.originalLogoPath
    if (originalPath && !originalPath.startsWith('s3://')) {
      const original = await realpath(path.resolve(backendRoot, originalPath))
      const storageRoot = await realpath(path.join(backendRoot, 'storage'))
      if (!original.startsWith(`${storageRoot}${path.sep}`) || !['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(original).toLowerCase())) throw new Error('Legacy original logo must be inside private storage.')
      const logoKey = `brands/lead-${lead.id}/${randomBytes(24).toString('hex')}/original${path.extname(original).toLowerCase()}`
      await store.put(logoKey, await readFile(original))
      job.brief = { ...job.brief, originalLogoPath: store.uri(logoKey) }
    }
    const artifacts = await uploadConcept(store, legacy, job, lead)
    let publication = {}
    if (job.publicationKey && !job.publicationManifest) {
      if (!/^[a-f0-9]{48}$/.test(job.publicationKey)) throw new Error('Invalid legacy publication key.')
      // Preserve the already approved snapshot, even if the working draft was subsequently edited.
      const scratch = await mkdtemp(path.join(os.tmpdir(), 'sixsummit-migrate-'))
      try {
        const source = path.join(backendRoot, 'storage/published', job.publicationKey)
        await cp(path.join(source, 'files'), path.join(scratch, 'authored'), { recursive: true, verbatimSymlinks: true })
        await mkdir(path.join(scratch, 'review'))
        await cp(path.join(source, 'desktop.png'), path.join(scratch, 'review/wide.png'))
        await cp(path.join(source, 'mobile.png'), path.join(scratch, 'review/narrow.png'))
        await cp(path.join(legacy, 'review/findings.json'), path.join(scratch, 'review/findings.json'))
        const snapshot = await uploadConcept(store, scratch, job, lead)
        publication = await publishConcept(store, { ...job, artifactManifest: snapshot.artifactManifest }, lead)
      } finally { await rm(scratch, { recursive: true, force: true }) }
    }
    await crm.update('six_concepts', job.id, { ...artifacts, ...publication, brief: job.brief })
    if (originalPath && lead.logoAssetPath === originalPath) await crm.update('six_leads', lead.id, { logoAssetPath: job.brief.originalLogoPath })
    migrated++
  }
  return { migrated, note: 'Local originals preserved. Verify remote restores before removing legacy files.' }
}
