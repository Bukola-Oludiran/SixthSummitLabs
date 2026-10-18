import { randomBytes } from 'node:crypto'
import { readdir, readFile, lstat, realpath, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { checksum, validKey } from '../services/object-storage/index.mjs'

export const publishableExtensions = new Set(['.html', '.css', '.js', '.mjs', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm'])
const maxFileBytes = 64 * 1024 * 1024
const maxBundleBytes = 512 * 1024 * 1024
const repositoryRoot = realpathSync(fileURLToPath(new URL('../../', import.meta.url)))
export function outsideCodebase(folder) {
  let ancestor = path.resolve(folder)
  const parts = []
  for (;;) {
    try { ancestor = realpathSync(ancestor); break }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      parts.unshift(path.basename(ancestor))
      ancestor = path.dirname(ancestor)
    }
  }
  const resolved = path.join(ancestor, ...parts)
  if (resolved === repositoryRoot || resolved.startsWith(`${repositoryRoot}${path.sep}`)) throw new Error('Design working folders must be outside the codebase.')
  return resolved
}
export function conceptIdentity(job, lead) {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(lead.id)) || !Number.isSafeInteger(job.briefVersion) || job.briefVersion < 1 || ![1, 2, 3].includes(job.conceptNumber)) throw new Error('Invalid design job identifier.')
  return { leadId: String(lead.id), briefVersion: job.briefVersion, conceptNumber: job.conceptNumber }
}
export function conceptWorkFolder(job, lead, { env }) {
  conceptIdentity(job, lead)
  const root = outsideCodebase(env.DESIGN_WORK_ROOT || path.join(os.tmpdir(), 'sixsummit-design-work'))
  return path.join(root, `lead-${lead.id}`, `v${job.briefVersion}`, `concept-${job.conceptNumber}`)
}
const sameIdentity = (a, b) => String(a.leadId) === String(b.leadId) && a.briefVersion === b.briefVersion && a.conceptNumber === b.conceptNumber
function validateManifest(manifest, identity) {
  if (manifest.version !== 1 || !sameIdentity(manifest, identity) || !Array.isArray(manifest.files) || manifest.files.length > 2000) throw new Error('Invalid design manifest identity.')
  const paths = new Set()
  let total = 0
  for (const file of manifest.files) {
    if (!validKey(file.path) || file.path.split('/').some(part => part.startsWith('.')) || paths.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > maxFileBytes) throw new Error('Invalid design manifest file.')
    paths.add(file.path)
    total += file.size
  }
  if (total > maxBundleBytes) throw new Error('Design bundle exceeds its size limit.')
  return manifest
}
export async function readManifest(store, uri, identity, kind = 'drafts') {
  const key = store.key(uri)
  const expected = kind === 'drafts' ? `drafts/lead-${identity.leadId}/v${identity.briefVersion}/concept-${identity.conceptNumber}/` : 'published/'
  const tail = key.slice(expected.length)
  if (!key.startsWith(expected) || !/^[a-f0-9]{48}\/manifest.json$/.test(tail)) throw new Error('Invalid design manifest location.')
  const bytes = await store.get(key)
  if (bytes.length > 1024 * 1024) throw new Error('Design manifest exceeds its size limit.')
  return { manifest: validateManifest(JSON.parse(bytes), identity), prefix: key.slice(0, -'manifest.json'.length) }
}
export async function artifactBytes(store, prefix, file) {
  const bytes = await store.get(`${prefix}${file.path}`)
  if (bytes.length !== file.size || checksum(bytes) !== file.sha256) throw new Error('Design artifact checksum mismatch.')
  return bytes
}
async function localFiles(folder, relative = '', files = []) {
  if ((await lstat(path.join(folder, relative))).isSymbolicLink()) throw new Error('Design artifacts cannot include symbolic links.')
  for (const item of await readdir(path.join(folder, relative), { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error('Design artifacts cannot include symbolic links.')
    if (item.name.startsWith('.') || item.name === 'node_modules') continue
    const name = relative ? `${relative}/${item.name}` : item.name
    if (!validKey(name)) throw new Error('Invalid design artifact path.')
    if (item.isDirectory()) await localFiles(folder, name, files)
    else if (item.isFile()) {
      const info = await lstat(path.join(folder, name))
      if (info.size > maxFileBytes) throw new Error('Design artifact exceeds 64 MiB.')
      files.push({ path: name, size: info.size })
      if (files.length > 2000 || files.reduce((sum, file) => sum + file.size, 0) > maxBundleBytes) throw new Error('Design bundle exceeds its size limit.')
    }
  }
  return files
}
export async function uploadConcept(store, folder, job, lead) {
  const identity = conceptIdentity(job, lead)
  if (!store) throw new Error('S3 storage is required before recording a completed design.')
  const files = await localFiles(folder)
  for (const name of ['authored/index.html', 'review/wide.png', 'review/narrow.png', 'review/findings.json']) if (!files.some(file => file.path === name)) throw new Error(`Missing design artifact: ${name}`)
  const findings = JSON.parse(await readFile(path.join(folder, 'review/findings.json'), 'utf8'))
  if (!findings.ok || findings.findingCount !== 0) throw new Error('Design browser checks must pass before upload.')
  const original = job.brief?.originalLogoPath
  if (original) {
    const remote = original.startsWith('s3://')
    const suffix = path.extname(remote ? new URL(original).pathname : original).toLowerCase()
    const preserved = await readFile(path.join(folder, 'authored/assets', `original-logo${suffix}`))
    if (!remote) throw new Error('Upload the original logo to S3 and rebrief before uploading the concept.')
    if (!preserved.equals(await store.get(store.key(original)))) throw new Error('The original logo was modified.')
  }
  const prefix = `drafts/lead-${lead.id}/v${job.briefVersion}/concept-${job.conceptNumber}/${randomBytes(24).toString('hex')}/`
  for (const file of files) {
    const bytes = await readFile(path.join(folder, file.path))
    file.size = bytes.length
    file.sha256 = checksum(bytes)
    await store.put(`${prefix}${file.path}`, bytes)
  }
  const manifest = validateManifest({ version: 1, ...identity, files }, identity)
  await store.put(`${prefix}manifest.json`, Buffer.from(JSON.stringify(manifest)), 'application/json')
  return { artifactManifest: store.uri(`${prefix}manifest.json`), htmlPath: store.uri(`${prefix}authored/index.html`), desktopPath: store.uri(`${prefix}review/wide.png`), mobilePath: store.uri(`${prefix}review/narrow.png`), findings }
}
export async function restoreConcept(store, uri, folder, job, lead) {
  const { manifest, prefix } = await readManifest(store, uri, conceptIdentity(job, lead))
  // Restoring into a fresh folder avoids symlinks and mixed revisions in an existing draft.
  await mkdir(folder, { recursive: true, mode: 0o700 })
  if ((await readdir(folder)).length) throw new Error('Restore destination must be empty.')
  const root = await realpath(folder)
  for (const file of manifest.files) {
    const target = path.join(root, file.path)
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
    await writeFile(target, await artifactBytes(store, prefix, file), { flag: 'wx', mode: 0o600 })
  }
  return folder
}
export async function publishConcept(store, job, lead) {
  const identity = conceptIdentity(job, lead)
  const draft = await readManifest(store, job.artifactManifest, identity)
  const key = randomBytes(24).toString('hex')
  const files = []
  for (const file of draft.manifest.files) {
    let name
    if (file.path === 'review/wide.png') name = 'desktop.png'
    else if (file.path === 'review/narrow.png') name = 'mobile.png'
    else if (file.path.startsWith('authored/') && !file.path.split('/').some(part => ['review', 'node_modules'].includes(part)) && publishableExtensions.has(path.extname(file.path).toLowerCase())) name = `files/${file.path.slice('authored/'.length)}`
    if (!name) continue
    await store.put(`published/${key}/${name}`, await artifactBytes(store, draft.prefix, file))
    files.push({ ...file, path: name })
  }
  for (const name of ['files/index.html', 'desktop.png', 'mobile.png']) if (!files.some(file => file.path === name)) throw new Error('Published design is incomplete.')
  await store.put(`published/${key}/manifest.json`, Buffer.from(JSON.stringify({ version: 1, ...identity, files })), 'application/json')
  return { publicationKey: key, publicationManifest: store.uri(`published/${key}/manifest.json`), publishedAt: new Date().toISOString() }
}
