import { randomBytes } from 'node:crypto'
import path from 'node:path'

import { publishConcept, readManifest, conceptIdentity, publishableExtensions } from './design-artifacts.mjs'

export const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/

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

// A published revision references verified objects in the private bucket.
export async function publishReviewedDesigns(crm, { store, publicSiteUrl } = {}) {
  const leads = await crm.list('six_leads', {}, { paginate: false })
  const concepts = await crm.list('six_concepts', {}, { paginate: false })
  const result = { linked: 0, published: 0, failed: 0 }
  for (const lead of leads) {
    await ensureDesignShare(crm, lead, { publicSiteUrl })
    result.linked++
    const jobs = concepts.filter((job) => job.leadId === lead.id && job.briefVersion === (lead.briefVersion || 1))
    for (const job of jobs) {
      if (![1, 2, 3].includes(job.conceptNumber)) continue
      const previewUrl = conceptShareUrl(lead, job.conceptNumber)
      if (job.previewUrl !== previewUrl) await crm.update('six_concepts', job.id, { previewUrl })
      if (!lead.designSharingEnabled || job.status !== 'ready' || job.publicationManifest) continue
      try {
        if (!store || !job.artifactManifest) throw new Error('S3 storage and an uploaded draft are required.')
        const publication = await publishConcept(store, job, lead)
        await crm.update('six_concepts', job.id, { ...publication, previewUrl })
        result.published++
      } catch { result.failed++ }
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
      const ready = job?.status === 'ready' && /^[a-f0-9]{48}$/.test(job.publicationKey || '') && Boolean(job.publicationManifest)
      const prefix = `/prospect-api/designs/${lead.designShareToken}/concepts/${number}`
      return { number, ready, ...(ready ? { title: job.direction, desktopUrl: `${prefix}/desktop.png`, mobileUrl: `${prefix}/mobile.png`, siteUrl: `${prefix}/files/index.html` } : {}) }
    }),
  }
}

export async function prospectFile(store, lead, jobs, number, filename) {
  const gallery = prospectGallery(lead, jobs)
  if (!gallery?.concepts.find((entry) => entry.number === number)?.ready) return null
  const job = jobs.find((entry) => entry.conceptNumber === number && entry.briefVersion === (lead.briefVersion || 1))
  if (!['desktop.png', 'mobile.png'].includes(filename) && (!filename.startsWith('files/') || !publishableExtensions.has(path.extname(filename).toLowerCase()))) return null
  const { manifest, prefix } = await readManifest(store, job.publicationManifest, conceptIdentity(job, lead), 'published')
  if (prefix !== `published/${job.publicationKey}/`) throw new Error('Invalid design manifest location.')
  const file = manifest.files.find(entry => entry.path === filename)
  if (!file) return null
  return { body: await store.open(`${prefix}${filename}`), size: file.size }
}
