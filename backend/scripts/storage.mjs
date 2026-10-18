import { randomBytes } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createObjectStore } from '../services/object-storage/index.mjs'
import { uploadConcept, restoreConcept, conceptWorkFolder, outsideCodebase } from '../src/design-artifacts.mjs'
import { migrateLegacyDesigns } from '../src/design-migration.mjs'
import { context, withWorkerLock } from './context.mjs'
import { environment, backendRoot } from './environment.mjs'

const [command, id, suppliedFolder] = process.argv.slice(2)
try {
  const env = await environment()
  const store = createObjectStore(env)
  if (command === 'check') {
    const key = `checks/${randomBytes(24).toString('hex')}`
    const bytes = Buffer.from('6ixSummit storage connectivity check')
    await store.put(key, bytes, 'text/plain')
    if (!(await store.get(key)).equals(bytes)) throw new Error('Storage round trip failed.')
    console.log('Private S3 upload, metadata verification and download passed. The checks/ object can expire through a bucket lifecycle rule.')
  } else {
    await withWorkerLock(async () => {
      const { crm } = await context()
      if (command === 'asset') {
        if (!/^\d+$/.test(id || '') || !suppliedFolder) throw new Error('Usage: npm run assets:upload -- LEAD_ID /absolute/path/original-logo.svg')
        const [lead] = await crm.list('six_leads', { id })
        if (!lead) throw new Error('Lead not found.')
        const file = path.resolve(suppliedFolder)
        const extension = path.extname(file).toLowerCase()
        if (!['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(extension) || !(await lstat(file)).isFile() || (await lstat(file)).size > 10 * 1024 * 1024) throw new Error('Original logo must be an image file under 10 MiB.')
        const key = `brands/lead-${lead.id}/${randomBytes(24).toString('hex')}/original${extension}`
        const bytes = await readFile(file)
        await store.put(key, bytes)
        const uri = store.uri(key)
        await crm.create('six_brand_assets', { leadId: lead.id, kind: 'original_logo', path: uri })
        await crm.update('six_leads', lead.id, { logoAssetPath: uri, logoStatus: 'found' })
        console.log(JSON.stringify({ leadId: lead.id, logoAssetPath: uri }))
        return
      }
      if (command === 'migrate') {
        if (id) throw new Error('Usage: npm run designs:migrate')
        console.log(JSON.stringify(await migrateLegacyDesigns(crm, store, { backendRoot })))
        return
      }
      if (!['upload', 'restore'].includes(command) || !/^\d+$/.test(id || '')) throw new Error('Usage: npm run designs:upload -- CONCEPT_ID [JOB_FOLDER], or npm run designs:restore -- CONCEPT_ID EMPTY_FOLDER')
      const [job] = await crm.list('six_concepts', { id })
      if (!job) throw new Error('Concept not found.')
      const [lead] = await crm.list('six_leads', { id: job.leadId })
      if (!lead) throw new Error('Lead not found.')
      const folder = outsideCodebase(suppliedFolder || conceptWorkFolder(job, lead, { backendRoot, env }))
      if (command === 'restore') {
        if (!suppliedFolder || !job.artifactManifest) throw new Error('Supply an empty restore folder and a concept with an uploaded bundle.')
        await restoreConcept(store, job.artifactManifest, folder, job, lead)
        console.log(JSON.stringify({ conceptId: job.id, folder }))
      } else {
        if (job.status === 'ready' || job.publicationKey) throw new Error('Approved concepts are immutable. Create a new brief version before uploading revisions.')
        const artifacts = await uploadConcept(store, folder, job, lead)
        await crm.update('six_concepts', job.id, { ...artifacts, status: 'needs_review', error: null })
        const all = await crm.list('six_concepts', { leadId: lead.id, briefVersion: lead.briefVersion || 1 }, { paginate: false })
        const status = all.some(entry => entry.status === 'failed') ? 'failed' : all.length === 3 && all.every(entry => ['ready', 'needs_review'].includes(entry.status)) ? 'needs_review' : 'queued'
        await crm.update('six_leads', lead.id, { designStatus: status })
        console.log(JSON.stringify({ conceptId: job.id, artifactManifest: artifacts.artifactManifest, status: 'needs_review' }))
      }
    })
  }
  store.close()
} catch (error) {
  // SDK diagnostics can contain provider details; keep CLI failures free of credentials.
  console.error(error.code === 'STORAGE_NOT_CONFIGURED' ? error.message : 'Storage operation failed. Check configuration, concept state, artifact paths and browser findings. No successful CRM upload is recorded until the complete bundle is verified.')
  process.exitCode = 1
}
