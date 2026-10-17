import { fingerprint, mergeDiscoveredLead, normalizePhone, qualify, conceptBriefs } from './leads.mjs'

export function budgetDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export async function queueConcepts(crm, lead, pilot) {
  // Research must establish whether there is a logo before proposing a replacement.
  if (!['found', 'not_found'].includes(lead.logoStatus)) return { queued: 0, needsBrandReview: true }
  const jobs = conceptBriefs(lead, pilot)
  const existing = await crm.list('six_concepts', { leadId: lead.id }, { paginate: false })
  const keys = new Set(existing.map((job) => job.jobKey))
  let queued = 0
  for (const job of jobs) {
    if (keys.has(job.jobKey)) continue
    await crm.create('six_concepts', job)
    queued++
  }
  if (lead.designStatus === 'not_queued' || !lead.designStatus) await crm.update('six_leads', lead.id, { designStatus: 'queued' })
  return { queued, needsBrandReview: false }
}

// Caller holds the local worker lock. The quota is reconstructed from lead rows,
// rather than an in-memory counter, so restarting cannot reset today's allowance.
export async function ingestCandidates(crm, candidates, pilot, now = new Date()) {
  const date = budgetDate(now)
  const timestamp = now.toISOString()
  const previous = await crm.list('six_leads', { qualifiedAt: { $not: null } }, { paginate: false })
  let used = previous.filter((lead) => !lead.isDemo && budgetDate(new Date(lead.qualifiedAt)) === date).length
  const summary = { budgetDate: date, target: pilot.dailyQualifiedLeadTarget, qualified: 0, held: 0, queued: 0, needsBrandReview: 0, duplicates: 0, usedBefore: used }
  for (const candidate of candidates) {
    if (!candidate.source?.sourceKey || !/^https:\/\//.test(candidate.source.sourceUrl || '')) throw new Error('Every imported business needs an HTTPS evidence URL and stable source key.')
    const key = fingerprint(candidate)
    const evidence = await crm.list('six_sources', { sourceKey: candidate.source.sourceKey })
    const matches = await crm.list('six_leads', evidence[0]?.leadId ? { id: evidence[0].leadId } : { fingerprint: key })
    let lead = matches[0]
    const { source, id: ignoredId, qualifiedAt: ignoredQualification, designStatus: ignoredDesign, ...facts } = candidate
    if (lead) {
      summary.duplicates++
      // Preserve a completed website check when an unverified OSM observation is refreshed.
      if (facts.websiteStatus === 'not_checked' && lead.websiteCheckedAt) delete facts.websiteStatus
      const merged = mergeDiscoveredLead(lead, facts)
      // Brand observations are explicit imports, never inferred from absence of a website tag.
      for (const field of ['logoStatus', 'logoAssetPath', 'brandPalette', 'motifs', 'services']) {
        if (facts[field] !== undefined) merged[field] = facts[field]
      }
      const updates = Object.fromEntries(Object.keys(merged).filter((field) => merged[field] !== lead[field]).map((field) => [field, merged[field]]))
      if (Object.keys(updates).length) await crm.update('six_leads', lead.id, updates)
      lead = merged
    } else {
      lead = await crm.create('six_leads', { ...facts, fingerprint: key, phone: normalizePhone(facts.phone), contactStatus: facts.contactStatus === 'do_not_call' ? 'do_not_call' : 'new', designStatus: 'not_queued', briefVersion: 1 })
    }
    if (!evidence.length) await crm.create('six_sources', { ...source, leadId: lead.id })
    const result = qualify(lead, pilot, now)
    if (!result.qualified) { summary.held++; continue }
    if (!lead.qualifiedAt) {
      if (used >= pilot.dailyQualifiedLeadTarget) { summary.held++; continue }
      await crm.update('six_leads', lead.id, { qualifiedAt: timestamp })
      lead.qualifiedAt = timestamp
      summary.qualified++
      used++
    }
    const queued = await queueConcepts(crm, lead, pilot)
    summary.queued += queued.queued
    summary.needsBrandReview += Number(queued.needsBrandReview)
  }
  summary.usedToday = used
  return summary
}

export async function runDesignQueue(crm, pilot, render, { limit = 30, now = new Date() } = {}) {
  const queued = await crm.list('six_concepts', { status: 'queued' }, { sort: ['id'], pageSize: limit })
  const waiting = queued.length < limit ? await crm.list('six_concepts', { status: 'awaiting_author' }, { sort: ['id'], pageSize: limit - queued.length }) : []
  const jobs = [...queued, ...waiting]
  const result = { ready: 0, failed: 0, held: 0 }
  for (const job of jobs) {
    const [lead] = await crm.list('six_leads', { id: job.leadId })
    if (!lead || !lead.qualifiedAt || !qualify(lead, pilot, now).qualified) { result.held++; continue }
    await crm.update('six_concepts', job.id, { status: 'running', error: null })
    await crm.update('six_leads', lead.id, { designStatus: 'generating' })
    try {
      const output = await render(job, lead)
      await crm.update('six_concepts', job.id, { ...output, status: output.status || 'ready' })
      if (output.status === 'needs_review') result.needsReview = (result.needsReview || 0) + 1
      else result.ready++
    } catch (error) {
      if (error.code === 'AWAITING_ASA_AUTHOR') {
        await crm.update('six_concepts', job.id, { status: 'awaiting_author', error: null })
        result.awaitingAuthor = (result.awaitingAuthor || 0) + 1
      } else {
        // Detailed tool output stays local; no secrets, prompts or remote bodies in the CRM error field.
        await crm.update('six_concepts', job.id, { status: 'failed', error: 'Rendering or quality checks failed. Inspect the private job log, then retry.' })
        result.failed++
      }
    }
    const all = await crm.list('six_concepts', { leadId: lead.id, briefVersion: lead.briefVersion || 1 })
    const status = all.some((entry) => entry.status === 'failed') ? 'failed' : all.length === pilot.conceptsPerLead && all.every((entry) => ['ready', 'needs_review'].includes(entry.status)) ? all.some((entry) => entry.status === 'needs_review') ? 'needs_review' : 'ready' : 'queued'
    await crm.update('six_leads', lead.id, { designStatus: status })
  }
  return result
}
