export const dispositions = {
  no_answer: { stage: 'follow_up', connected: false },
  voicemail: { stage: 'follow_up', connected: false },
  busy: { stage: 'follow_up', connected: false },
  gatekeeper: { stage: 'follow_up', connected: true },
  callback_requested: { stage: 'follow_up', connected: true },
  interested: { stage: 'interested', connected: true },
  meeting_booked: { stage: 'meeting_booked', connected: true },
  proposal_sent: { stage: 'proposal_sent', connected: true },
  won: { stage: 'won', connected: true },
  lost: { stage: 'lost', connected: true },
  wrong_number: { stage: 'invalid_contact', connected: false },
  do_not_call: { stage: 'do_not_call', connected: true },
} as const;

export type Disposition = keyof typeof dispositions;
export interface Lead {
  id: number;
  city?: string;
  businessName?: string;
  contactStatus?: string;
  assignedToUserId?: number | null;
  assignedTo?: string | null;
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
  qualifiedAt?: string | null;
  firstMeetingAt?: string | null;
  wonAt?: string | null;
  wonValueCents?: number | null;
  isDemo?: boolean;
}
export interface OutcomeInput {
  requestId: string;
  leadId: number;
  disposition: Disposition;
  kind: 'call' | 'stage_update';
  notes: string;
  followUpAt: string | null;
  meetingAt: string | null;
  lossReason: string | null;
  valueCents: number | null;
}
export interface Activity extends Omit<Partial<OutcomeInput>, 'kind'> {
  id?: number;
  leadId: number;
  kind: string;
  occurredAt: string;
  callerId?: number;
  caller?: string;
  city?: string;
  isDemo?: boolean;
}
export class FlowError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 422) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
const optionalText = (value: unknown, max: number) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > max) throw new FlowError('Invalid text value');
  return value.trim() || null;
};

export function normalizeOutcome(value: Record<string, unknown>, now = new Date()): OutcomeInput {
  if (typeof value.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(value.requestId))
    throw new FlowError('A stable requestId is required');
  if (typeof value.leadId !== 'number' || !Number.isSafeInteger(value.leadId) || value.leadId <= 0)
    throw new FlowError('A valid leadId is required');
  if (typeof value.disposition !== 'string' || !Object.hasOwn(dispositions, value.disposition))
    throw new FlowError('Unknown disposition');
  const kind = value.kind ?? 'call';
  if (kind !== 'call' && kind !== 'stage_update') throw new FlowError('Invalid activity kind');
  if (
    kind === 'stage_update' &&
    ['no_answer', 'voicemail', 'busy', 'gatekeeper', 'wrong_number'].includes(value.disposition)
  )
    throw new FlowError('This disposition requires a call attempt');
  const futureDate = (date: unknown) => {
    if (date === undefined || date === null || date === '') return null;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(date))
      throw new FlowError('Dates must include a timezone');
    const parsed = new Date(date);
    if (!Number.isFinite(parsed.getTime()) || parsed <= now)
      throw new FlowError('The next action must be in the future');
    return parsed.toISOString();
  };
  const input: OutcomeInput = {
    requestId: value.requestId,
    leadId: Number(value.leadId),
    disposition: value.disposition as Disposition,
    kind,
    notes: optionalText(value.notes, 10000) || '',
    followUpAt: futureDate(value.followUpAt),
    meetingAt: futureDate(value.meetingAt),
    lossReason: optionalText(value.lossReason, 500),
    valueCents: value.valueCents === undefined || value.valueCents === null ? null : Number(value.valueCents),
  };
  if (value.valueCents !== undefined && value.valueCents !== null && typeof value.valueCents !== 'number')
    throw new FlowError('Project value must be a non-negative integer in CAD cents');
  if (input.valueCents !== null && (!Number.isSafeInteger(input.valueCents) || input.valueCents < 0))
    throw new FlowError('Project value must be a non-negative integer in CAD cents');
  if (input.disposition === 'callback_requested' && !input.followUpAt)
    throw new FlowError('A callback date is required');
  if (input.disposition === 'meeting_booked' && !input.meetingAt) throw new FlowError('A meeting date is required');
  if (input.disposition === 'lost' && !input.lossReason) throw new FlowError('A loss reason is required');
  if (input.disposition === 'won' && input.valueCents === null) throw new FlowError('A won project value is required');
  return input;
}

export function projectOutcome(lead: Lead, input: OutcomeInput, now = new Date()) {
  if (lead.contactStatus === 'do_not_call') throw new FlowError('This business has opted out', 409);
  if (['won', 'lost', 'invalid_contact'].includes(lead.contactStatus || ''))
    throw new FlowError('Reopen this lead before recording another outcome', 409);
  const terminal = ['won', 'lost', 'wrong_number', 'do_not_call'].includes(input.disposition);
  const timestamp = now.toISOString();
  const next = terminal ? null : input.disposition === 'meeting_booked' ? input.meetingAt : input.followUpAt;
  const stages = ['new', 'assigned', 'called', 'follow_up', 'interested', 'meeting_booked', 'proposal_sent'];
  const intended = dispositions[input.disposition].stage;
  const stage = terminal
    ? intended
    : stages[Math.max(stages.indexOf(lead.contactStatus || 'new'), stages.indexOf(intended))];
  return {
    contactStatus: stage,
    lastDisposition: input.disposition,
    lastContactAt: timestamp,
    nextFollowUpAt: next,
    ...(input.disposition === 'meeting_booked'
      ? {
          meetingAt: input.meetingAt,
          firstMeetingAt: lead.firstMeetingAt || timestamp,
        }
      : {}),
    ...(terminal ? { meetingAt: null } : {}),
    ...(input.disposition === 'won' ? { wonAt: timestamp, wonValueCents: input.valueCents, currency: 'CAD' } : {}),
    ...(input.disposition === 'lost' ? { lostAt: timestamp, lossReason: input.lossReason } : {}),
    ...(input.disposition === 'do_not_call' ? { optedOutAt: timestamp } : {}),
  };
}

export interface AnalyticsFilter {
  from: string;
  to: string;
  callerId?: number;
  city?: string;
}
export function summarize(leads: Lead[], activities: Activity[], filter: AnalyticsFilter, now = new Date()) {
  const from = new Date(filter.from).getTime();
  const to = new Date(filter.to).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 366 * 86400000)
    throw new FlowError('Provide a valid analytics range of at most 366 days');
  const inRange = (value?: string | null) => {
    const date = new Date(value || '').getTime();
    return date >= from && date < to;
  };
  const selected = activities.filter(
    (event) =>
      !event.isDemo &&
      ['call', 'stage_update'].includes(event.kind) &&
      inRange(event.occurredAt) &&
      (!filter.callerId || event.callerId === filter.callerId) &&
      (!filter.city || event.city === filter.city),
  );
  const calls = selected.filter((event) => event.kind === 'call');
  const connected = calls.filter((event) => event.disposition && dispositions[event.disposition]?.connected);
  const meetings = new Set(
    selected.filter((event) => event.disposition === 'meeting_booked').map((event) => event.leadId),
  );
  const wins = new Map<number, Activity>();
  for (const event of selected)
    if (event.disposition === 'won' && !wins.has(event.leadId)) wins.set(event.leadId, event);
  const eligible = leads.filter(
    (lead) =>
      !lead.isDemo &&
      (!filter.city || lead.city === filter.city) &&
      (!filter.callerId || lead.assignedToUserId === filter.callerId),
  );
  const outcomes: Record<string, number> = {};
  const byCaller: Record<string, number> = {};
  const callerNames: Record<string, string> = {};
  const byCity: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const event of calls) {
    if (event.disposition) outcomes[event.disposition] = (outcomes[event.disposition] || 0) + 1;
    const caller = String(event.callerId ?? 'unassigned');
    byCaller[caller] = (byCaller[caller] || 0) + 1;
    if (event.caller) callerNames[caller] = event.caller;
    const city = event.city || 'Unknown';
    byCity[city] = (byCity[city] || 0) + 1;
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Edmonton',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(event.occurredAt));
    byDay[day] = (byDay[day] || 0) + 1;
  }
  const uniqueCalled = new Set(calls.map((event) => event.leadId)).size;
  const meetingCohort = eligible.filter((lead) => inRange(lead.firstMeetingAt));
  const meetingCohortWins = meetingCohort.filter(
    (lead) => lead.wonAt && new Date(lead.wonAt) >= new Date(lead.firstMeetingAt || '') && new Date(lead.wonAt) <= now,
  ).length;
  return {
    range: {
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      endExclusive: true,
      timeZone: 'America/Edmonton',
    },
    metrics: {
      callAttempts: calls.length,
      uniqueBusinessesCalled: uniqueCalled,
      connectedCalls: connected.length,
      connectionRate: calls.length ? connected.length / calls.length : null,
      meetingsBooked: meetings.size,
      projectsWon: wins.size,
      meetingCohort: meetingCohort.length,
      meetingCohortWins,
      meetingToWinConversion: meetingCohort.length ? meetingCohortWins / meetingCohort.length : null,
      wonValueCents: [...wins.values()].reduce((sum, event) => sum + (event.valueCents || 0), 0),
      currency: 'CAD',
      qualifiedLeads: eligible.filter((lead) => inRange(lead.qualifiedAt)).length,
      overdueFollowUps: eligible.filter(
        (lead) =>
          lead.nextFollowUpAt &&
          new Date(lead.nextFollowUpAt) < now &&
          !['won', 'lost', 'do_not_call', 'invalid_contact'].includes(lead.contactStatus || ''),
      ).length,
    },
    outcomes,
    byCaller,
    callerNames,
    byCity,
    byDay,
    definitions: {
      meetingsBooked:
        'Distinct businesses with a meeting-booked event in the selected period; repeated bookings count once.',
      projectsWon:
        'Distinct businesses with a won event in the selected period; project value counts once per business.',
      connectionRate: 'Connected call attempts divided by all call attempts. Manual stage updates are excluded.',
      qualifiedLeads: 'Leads qualified in the period, scoped to their current assignment when a caller filter is used.',
      overdueFollowUps:
        'Current overdue follow-ups; scoped to current assignment and city, independently of the event date range.',
      cohorts: 'Meeting and win counts are period activity counts, not a same-cohort funnel conversion rate.',
      meetingToWinConversion:
        'Of businesses whose first meeting was booked in the period, the fraction won by now. Caller filters use current ownership for this cohort.',
    },
  };
}
