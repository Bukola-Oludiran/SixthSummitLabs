import { createHash } from 'node:crypto'

export function normalizePhone(value) {
  const digits = String(value || '').split(/(?:ext\.?|x|#)\s*\d+/i)[0].replace(/\D/g, '')
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(local) ? `+1${local}` : null
}

export const normalized = (value) => String(value || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function fingerprint(lead) {
  const key = [normalized(lead.businessName), normalizePhone(lead.phone) || '', normalized(lead.city), normalized(lead.address)].join('|')
  return createHash('sha256').update(key).digest('hex')
}

export function qualify(lead, pilot, now = new Date()) {
  const reasons = []
  if (!lead.businessName?.trim()) reasons.push('missing_name')
  if (!normalizePhone(lead.phone)) reasons.push('missing_valid_phone')
  if (!pilot.cities.some((city) => normalized(city.name) === normalized(lead.city) && city.province === lead.province)) reasons.push('outside_target_area')
  if (lead.isDemo) reasons.push('demonstration_record')
  if (['do_not_call', 'invalid_contact', 'won', 'lost'].includes(lead.contactStatus)) reasons.push(lead.contactStatus)
  if (!['none_found', 'social_only'].includes(lead.websiteStatus)) reasons.push('website_not_qualified')
  const checked = new Date(lead.websiteCheckedAt).getTime()
  const age = now.getTime() - checked
  if (!Number.isFinite(checked) || age < 0 || age > pilot.websiteEvidenceMaxAgeDays * 86400000) reasons.push('stale_website_check')
  const searches = lead.websiteEvidence?.searches || []
  const complete = searches.filter((search) => search.outcome === 'complete' && search.query?.trim())
  if (new Set(complete.map((search) => search.query)).size < 2) reasons.push('insufficient_website_evidence')
  if (searches.some((search) => search.outcome !== 'complete')) reasons.push('incomplete_website_search')
  if (lead.websiteEvidence?.unresolvedDomains?.length) reasons.push('possible_website_needs_review')
  return { qualified: reasons.length === 0, reasons }
}

export function mergeDiscoveredLead(existing, discovered) {
  const fields = ['businessName', 'phone', 'email', 'category', 'city', 'province', 'country', 'address', 'socialLinks', 'websiteStatus', 'websiteEvidence', 'websiteCheckedAt']
  const next = { ...existing }
  for (const key of fields) if (discovered[key] !== undefined && discovered[key] !== null && discovered[key] !== '') next[key] = discovered[key]
  // Discovery never changes caller ownership, call notes, opt-outs or design approvals.
  return next
}

export function conceptBriefs(lead, pilot) {
  if (lead.logoStatus === 'found' && !lead.logoAssetPath) throw new Error('An existing logo was found but its original asset is missing.')
  const palette = (lead.brandPalette || []).filter((colour) => /^#[0-9a-f]{6}$/i.test(colour))
  return pilot.conceptDirections.map((direction) => ({
    jobKey: `${lead.id}:${lead.briefVersion || 1}:${direction.number}`,
    leadId: lead.id,
    conceptNumber: direction.number,
    briefVersion: lead.briefVersion || 1,
    direction: direction.name,
    status: 'queued',
    brief: {
      businessName: lead.businessName,
      category: lead.category,
      city: lead.city,
      phone: normalizePhone(lead.phone),
      email: lead.email || null,
      address: lead.address || null,
      services: lead.services || [],
      businessNotes: lead.businessNotes || '',
      motifs: lead.motifs || [],
      originalLogoPath: lead.logoStatus === 'found' ? lead.logoAssetPath : null,
      logoTreatment: lead.logoStatus === 'found' ? 'preserve_original' : 'proposed_identity',
      requiredPalette: direction.preservePalette ? palette : [],
      paletteSource: palette.length ? 'observed_business_brand' : 'no_observed_palette',
      primaryAction: 'phone_call',
      visibility: 'private_concept',
      visualRequirements: { standard: 2, contentImage: true },
      copyRules: ['Use observed facts only.', 'Do not invent ratings, reviews, opening hours, prices or guarantees.'],
    },
  }))
}
