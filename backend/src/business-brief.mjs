import { qualify } from './leads.mjs'
import { budgetDate } from './pipeline.mjs'
import { siteOrigin } from './design-sharing.mjs'

const closed = new Set(['won', 'lost', 'invalid_contact', 'do_not_call'])
const tally = (rows, field) => rows.reduce((counts, row) => { const key = row[field] || 'unknown'; counts[key] = (counts[key] || 0) + 1; return counts }, {})
const timestamp = (value) => value ? new Date(value).getTime() : NaN

export function businessBrief({ leads, concepts, runs, sales, pilot, publicSiteUrl, now = new Date() }) {
  const real = leads.filter(lead => !lead.isDemo)
  const byId = new Map(real.map(lead => [lead.id, lead]))
  const open = real.filter(lead => !closed.has(lead.contactStatus))
  const current = concepts.filter(job => byId.has(job.leadId) && job.briefVersion === (byId.get(job.leadId).briefVersion || 1))
  const date = budgetDate(now)
  const qualifiedToday = real.filter(lead => Number.isFinite(timestamp(lead.qualifiedAt)) && budgetDate(new Date(lead.qualifiedAt)) === date).length
  const dueBy = now.getTime() + 7 * 86400000
  const describe = lead => ({ leadId: lead.id, businessName: lead.businessName, city: lead.city, assignedTo: lead.assignedTo || null })
  const followUps = open.filter(lead => timestamp(lead.nextFollowUpAt) <= dueBy).sort((a,b) => timestamp(a.nextFollowUpAt) - timestamp(b.nextFollowUpAt)).map(lead => ({ ...describe(lead), dueAt: lead.nextFollowUpAt, overdue: timestamp(lead.nextFollowUpAt) < now.getTime() }))
  const meetings = open.filter(lead => timestamp(lead.meetingAt) >= now.getTime() && timestamp(lead.meetingAt) <= dueBy).sort((a,b) => timestamp(a.meetingAt) - timestamp(b.meetingAt)).map(lead => ({ ...describe(lead), meetingAt: lead.meetingAt }))
  const latestRuns = [...runs].sort((a,b) => timestamp(b.startedAt) - timestamp(a.startedAt)).slice(0, 5).map(run => ({ id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt || null, qualifiedCount: run.qualifiedCount || 0, sourceErrorCount: run.summary?.sourceErrors?.length || 0 }))
  const origin = siteOrigin(publicSiteUrl)
  const localOnly = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)
  const jobsNeedingAttention = current.filter(job => ['failed', 'awaiting_author', 'needs_review'].includes(job.status) || (job.status === 'ready' && !job.publicationKey)).map(job => ({ ...describe(byId.get(job.leadId)), conceptNumber: job.conceptNumber, status: job.status, published: Boolean(job.publicationKey), previewUrl: byId.get(job.leadId).designSharingEnabled ? job.previewUrl || null : null }))
  return {
    generatedAt: now.toISOString(), timeZone: 'America/Edmonton', businessDate: date,
    source: 'Live NocoBase records and authenticated sales summary; demonstration records excluded.',
    dailyTarget: { target: pilot.dailyQualifiedLeadTarget, qualifiedToday, remaining: Math.max(0, pilot.dailyQualifiedLeadTarget - qualifiedToday), cities: pilot.cities.map(city => city.name) },
    pipeline: { totalBusinesses: real.length, byStage: tally(real, 'contactStatus'), qualifiedEver: real.filter(lead => lead.qualifiedAt).length, currentlyCallable: open.filter(lead => lead.qualifiedAt && qualify(lead, pilot, now).qualified).length, needsQualificationResearch: open.filter(lead => !qualify(lead, pilot, now).qualified).length },
    sales: { ...sales, interpretation: 'Won project value is booked project value in CAD, not money collected. Manual sales updates are not call attempts.' },
    billing: { collectedRevenueCents: null, outstandingInvoicesCents: null, status: 'No invoice or payment ledger is connected. These amounts are unknown.' },
    nextActions: { horizonDays: 7, followUps, upcomingMeetings: meetings, designs: jobsNeedingAttention },
    designs: { totalCurrentConcepts: current.length, byStatus: tally(current, 'status'), publishedConcepts: current.filter(job => job.status === 'ready' && /^[a-f0-9]{48}$/.test(job.publicationKey || '') && byId.get(job.leadId).designSharingEnabled).length },
    latestRuns,
    sharing: { configuredOrigin: origin, localOnly, reachability: 'not_checked', note: localOnly ? 'Prospect links currently work on this computer only.' : 'A configured origin does not confirm a live deployment.' },
  }
}

export async function readBusinessBrief(crm, options) {
  const now = options.now || new Date()
  const days = options.days ?? 7
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('Reporting days must be an integer from 1 to 366.')
  const [leads, concepts, runs, summary] = await Promise.all([
    crm.list('six_leads', {}, { paginate: false }),
    crm.list('six_concepts', {}, { paginate: false }),
    crm.list('six_runs', {}, { paginate: false }),
    crm.request('six_crm', 'summary', { query: { from: new Date(now.getTime() - days * 86400000).toISOString(), to: now.toISOString() } }),
  ])
  return businessBrief({ ...options, now, leads, concepts, runs, sales: summary.data })
}
