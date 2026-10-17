import { randomBytes } from 'node:crypto'
import { copyFile, mkdir, readdir, realpath, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'

export const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/
const publishableExtensions = new Set(['.html', '.css', '.js', '.mjs', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm'])

export function siteOrigin(value = 'http://127.0.0.1:5173') {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('PUBLIC_SITE_URL must be an HTTP(S) origin without a path or credentials.')
  return url.origin
}

export function newDesignShare(publicSiteUrl) {
  const designShareToken = randomBytes(32).toString('base64url')
  return { designShareToken, designShareUrl: `${siteOrigin(publicSiteUrl)}/designs/${designShareToken}`, designSharingEnabled: true }
}

export async function ensureDesignShare(crm, lead, { publicSiteUrl } = {}) {
  const values = shareTokenPattern.test(lead.designShareToken || '')
    ? { designShareUrl: `${siteOrigin(publicSiteUrl)}/designs/${lead.designShareToken}` }
    : newDesignShare(publicSiteUrl)
  if (Object.entries(values).some(([key, value]) => lead[key] !== value)) {
    await crm.update('six_leads', lead.id, values)
    Object.assign(lead, values)
  }
  return lead.designShareUrl
}

export function conceptShareUrl(lead, number) {
  return `${lead.designShareUrl}?concept=${number}`
}

export async function confinedFile(root, filename) {
  if (typeof filename !== 'string' || !filename || filename.includes('\0')) throw new Error('Invalid publication file.')
  const base = await realpath(root)
  const resolved = await realpath(path.resolve(base, filename))
  if (!resolved.startsWith(`${base}${path.sep}`) || !(await stat(resolved)).isFile()) throw new Error('Publication file is outside its allowed directory.')
  return resolved
}

async function copyPublicTree(source, destination) {
  for (const item of await readdir(source, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error('Published concepts cannot include symbolic links.')
    if (item.name.startsWith('.') || ['node_modules', 'review'].includes(item.name)) continue
    const from = path.join(source, item.name)
    const to = path.join(destination, item.name)
    if (item.isDirectory()) {
      await mkdir(to, { recursive: true, mode: 0o700 })
      await copyPublicTree(from, to)
    } else if (item.isFile() && publishableExtensions.has(path.extname(item.name).toLowerCase())) {
      await copyFile(from, to)
    }
  }
}

// The source is frozen once per approved job. Rebrief with a new version to publish changes.
export async function publishReviewedDesigns(crm, { backendRoot, publicSiteUrl } = {}) {
  const leads = await crm.list('six_leads', {}, { paginate: false })
  const concepts = await crm.list('six_concepts', {}, { paginate: false })
  const result = { linked: 0, published: 0, failed: 0 }
  const storage = path.join(backendRoot, 'storage')
  const published = path.join(storage, 'published')
  await mkdir(published, { recursive: true, mode: 0o700 })
  for (const lead of leads) {
    await ensureDesignShare(crm, lead, { publicSiteUrl })
    result.linked++
    const jobs = concepts.filter((job) => job.leadId === lead.id && job.briefVersion === (lead.briefVersion || 1))
    for (const job of jobs) {
      if (![1, 2, 3].includes(job.conceptNumber)) continue
      const previewUrl = conceptShareUrl(lead, job.conceptNumber)
      if (job.previewUrl !== previewUrl) await crm.update('six_concepts', job.id, { previewUrl })
      if (!lead.designSharingEnabled || job.status !== 'ready' || job.publicationKey) continue
      const key = randomBytes(24).toString('hex')
      const temporary = path.join(published, `.pending-${key}`)
      try {
        const html = await confinedFile(path.join(storage, 'concepts'), path.relative(path.join(storage, 'concepts'), path.resolve(backendRoot, job.htmlPath || '')))
        if (path.basename(html) !== 'index.html' || path.basename(path.dirname(html)) !== 'authored') throw new Error('Only authored homepage folders can be published.')
        const expected = path.join(storage, 'concepts', `lead-${lead.id}`, `v${job.briefVersion}`, `concept-${job.conceptNumber}`, 'authored')
        if (await realpath(expected) !== path.dirname(html)) throw new Error('The concept does not belong to this lead and version.')
        await mkdir(path.join(temporary, 'files'), { recursive: true, mode: 0o700 })
        await copyPublicTree(path.dirname(html), path.join(temporary, 'files'))
        for (const [field, name] of [['desktopPath', 'desktop.png'], ['mobilePath', 'mobile.png']]) {
          const screenshot = await confinedFile(path.dirname(expected), path.relative(path.dirname(expected), path.resolve(backendRoot, job[field] || '')))
          if (path.extname(screenshot) !== '.png') throw new Error('A PNG review capture is required.')
          await copyFile(screenshot, path.join(temporary, name))
        }
        await rename(temporary, path.join(published, key))
        await crm.update('six_concepts', job.id, { publicationKey: key, publishedAt: new Date().toISOString(), previewUrl })
        result.published++
      } catch {
        await rm(temporary, { recursive: true, force: true })
        result.failed++
      }
    }
  }
  return result
}

export function prospectGallery(lead, jobs) {
  const visible = lead.designSharingEnabled && shareTokenPattern.test(lead.designShareToken || '')
  if (!visible) return null
  return {
    businessName: lead.businessName,
    city: lead.city,
    concepts: [1, 2, 3].map((number) => {
      const job = jobs.find((entry) => entry.conceptNumber === number && entry.briefVersion === (lead.briefVersion || 1))
      const ready = job?.status === 'ready' && /^[a-f0-9]{48}$/.test(job.publicationKey || '')
      const prefix = `/prospect-api/designs/${lead.designShareToken}/concepts/${number}`
      return { number, ready, ...(ready ? { title: job.direction, desktopUrl: `${prefix}/desktop.png`, mobileUrl: `${prefix}/mobile.png`, siteUrl: `${prefix}/files/index.html` } : {}) }
    }),
  }
}

export async function prospectFile(backendRoot, lead, jobs, number, filename) {
  const gallery = prospectGallery(lead, jobs)
  if (!gallery?.concepts.find((entry) => entry.number === number)?.ready) return null
  const job = jobs.find((entry) => entry.conceptNumber === number && entry.briefVersion === (lead.briefVersion || 1))
  if (!['desktop.png', 'mobile.png'].includes(filename) && (!filename.startsWith('files/') || !publishableExtensions.has(path.extname(filename).toLowerCase()))) return null
  return confinedFile(path.join(backendRoot, 'storage/published', job.publicationKey), filename)
}
