import { budgetDate } from './pipeline.mjs'
import { qualify } from './leads.mjs'

export function automationConfiguration(env, { storage = true } = {}) {
  const missing = ['NOCOBASE_API_KEY', ...(storage ? [
    'DESIGN_S3_BUCKET', 'DESIGN_S3_REGION', 'DESIGN_S3_ENDPOINT',
    'DESIGN_S3_ACCESS_KEY_ID', 'DESIGN_S3_SECRET_ACCESS_KEY',
  ] : [])].filter(key => !env[key]?.trim())
  for (const [key, expected] of Object.entries({
    NOCOBASE_URL: 'https://6ixsummitlabs.com/crm',
    PUBLIC_SITE_URL: 'https://6ixsummitlabs.com',
  })) {
    if (env[key]?.replace(/\/+$/, '') !== expected) missing.push(key)
  }
  return { ok: missing.length === 0, missing }
}

export function automationStatus(leads, concepts, pilot, now = new Date()) {
  const date = budgetDate(now)
  const real = leads.filter(lead => !lead.isDemo)
  const used = real.filter(lead => lead.qualifiedAt && budgetDate(new Date(lead.qualifiedAt)) === date).length
  const eligible = new Map(real.filter(lead => lead.qualifiedAt && qualify(lead, pilot, now).qualified).map(lead => [String(lead.id), lead]))
  const current = concepts.filter(job => eligible.has(String(job.leadId)) && job.briefVersion === (eligible.get(String(job.leadId)).briefVersion || 1))
  const pending = current.filter(job => !job.artifactManifest && !job.publicationKey && ['queued', 'awaiting_author', 'running', 'failed'].includes(job.status))
    .sort((a, b) => Number(a.id) - Number(b.id))
  return {
    budgetDate: date, target: pilot.dailyQualifiedLeadTarget, qualifiedToday: used,
    remainingToday: Math.max(0, pilot.dailyQualifiedLeadTarget - used),
    needsBrandResearch: [...eligible.values()].filter(lead => !['found', 'not_found'].includes(lead.logoStatus)).map(lead => ({ leadId: lead.id, businessName: lead.businessName })),
    pending: pending.slice(0, pilot.dailyQualifiedLeadTarget * pilot.conceptsPerLead).map(job => ({
      conceptId: job.id, leadId: job.leadId, businessName: eligible.get(String(job.leadId)).businessName,
      conceptNumber: job.conceptNumber, status: job.status, previewUrl: job.previewUrl,
    })),
    pendingTotal: pending.length,
    needsReview: current.filter(job => job.status === 'needs_review').length,
  }
}

export function assertAuthorable(job, lead, pilot, now = new Date()) {
  if (!job || !lead || lead.isDemo || !lead.qualifiedAt || !qualify(lead, pilot, now).qualified
    || job.briefVersion !== (lead.briefVersion || 1) || job.artifactManifest || job.publicationKey
    || !['queued', 'awaiting_author', 'running', 'failed'].includes(job.status)) {
    throw new Error('Concept is not eligible for authoring. Check current research, lead state, version and existing upload.')
  }
}
