export const cities = ['Regina', 'Edmonton', 'Calgary']
export const stages = [
  'new',
  'assigned',
  'called',
  'follow_up',
  'interested',
  'meeting_booked',
  'proposal_sent',
  'won',
  'lost',
  'invalid_contact',
  'do_not_call',
]
export const closedStages = new Set(['won', 'lost', 'invalid_contact', 'do_not_call'])
export const callOnly = new Set(['no_answer', 'voicemail', 'busy', 'gatekeeper', 'wrong_number'])
export const label = (value) =>
  value ? value.replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase()) : 'Not recorded'
export const money = (cents) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(
    (cents || 0) / 100
  )
export const percent = (value) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 1 }).format(value)
export const dateTime = (value) =>
  value && Number.isFinite(new Date(value).getTime())
    ? new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Not scheduled'
export const overdue = (value) => value && new Date(value).getTime() < Date.now()
export function safeLink(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}
export const galleryPath = (lead) =>
  /^[A-Za-z0-9_-]{43}$/.test(lead.designShareToken || '') ? `/designs/${lead.designShareToken}` : null
export function cadCents(value) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value))
    throw new Error('Enter a CAD amount with up to two decimal places.')
  const [whole, fraction = ''] = value.split('.')
  const cents = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')))
  if (!Number.isSafeInteger(cents)) throw new Error('This project value is too large.')
  return cents
}
export function outcomePayload(form, leadId) {
  const disposition = form.get('disposition')
  const kind = form.get('kind')
  if (kind === 'stage_update' && callOnly.has(disposition))
    throw new Error('Choose an outcome that can be recorded without a call.')
  const iso = (value) => {
    if (!value) return null
    const date = new Date(value)
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
      throw new Error('Schedule the next action in the future.')
    return date.toISOString()
  }
  return {
    leadId: Number(leadId),
    kind,
    disposition,
    notes: form.get('notes') || '',
    followUpAt: iso(
      ['won', 'lost', 'wrong_number', 'do_not_call', 'meeting_booked'].includes(disposition)
        ? null
        : form.get('followUpAt')
    ),
    meetingAt: iso(disposition === 'meeting_booked' ? form.get('meetingAt') : null),
    lossReason: disposition === 'lost' ? form.get('lossReason') : null,
    valueCents: disposition === 'won' ? cadCents(form.get('valueDollars')) : null,
  }
}
export function qualifiedForCall(lead, now = Date.now()) {
  if (
    !lead.qualifiedAt ||
    !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(lead.phone || '') ||
    closedStages.has(lead.contactStatus)
  )
    return false
  // An existing sales conversation can continue after its discovery evidence ages.
  if (lead.lastContactAt) return true
  const age = now - new Date(lead.websiteCheckedAt).getTime()
  const searches = lead.websiteEvidence?.searches || []
  const target = { Regina: 'SK', Edmonton: 'AB', Calgary: 'AB' }
  return Boolean(
    lead.qualifiedAt &&
      lead.businessName?.trim() &&
      /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(lead.phone || '') &&
      target[lead.city] === lead.province &&
      ['none_found', 'social_only'].includes(lead.websiteStatus) &&
      Number.isFinite(age) &&
      age >= 0 &&
      age <= 7 * 86400000 &&
      new Set(
        searches
          .filter((search) => search.outcome === 'complete' && search.query?.trim())
          .map((search) => search.query)
      ).size >= 2 &&
      searches.every((search) => search.outcome === 'complete') &&
      !lead.websiteEvidence?.unresolvedDomains?.length &&
      !closedStages.has(lead.contactStatus)
  )
}
export function routeFor(pathname) {
  const match = /^\/crm\/leads\/(\d+)\/?$/.exec(pathname)
  if (match) return { view: 'detail', leadId: Number(match[1]) }
  const view = pathname.replace(/^\/crm\/?/, '').replace(/\/$/, '')
  return {
    view: ['', 'login'].includes(view)
      ? 'overview'
      : ['leads', 'follow-ups', 'designs', 'analytics'].includes(view)
      ? view
      : 'missing',
  }
}
