import { test } from 'vitest';
import assert from 'node:assert/strict';
import { normalizeOutcome, projectOutcome, summarize } from '../domain';
import type { Activity } from '../domain';

const now = new Date('2026-10-17T17:00:00Z');
const base = {
  requestId: 'request-0000000001',
  leadId: 1,
  disposition: 'no_answer',
  kind: 'call',
};
const input = (extra: Record<string, unknown> = {}) => normalizeOutcome({ ...base, ...extra }, now);

test('outcomes require the dates, reasons and integer project value that give the next action meaning', () => {
  assert.throws(() => input({ disposition: 'callback_requested' }), /callback date/);
  assert.throws(() => input({ disposition: 'meeting_booked' }), /meeting date/);
  assert.throws(() => input({ disposition: 'lost' }), /loss reason/);
  assert.throws(() => input({ disposition: 'won' }), /project value/);
  assert.throws(() => input({ disposition: 'won', valueCents: 100.5 }), /CAD cents/);
  assert.throws(() => input({ followUpAt: '2026-10-18' }), /timezone/);
  assert.throws(() => input({ followUpAt: '2026-10-16T10:00:00Z' }), /future/);
  assert.throws(() => input({ disposition: 'no_answer', kind: 'stage_update' }), /call attempt/);
  assert.throws(() => input({ disposition: '__proto__' }), /Unknown disposition/);
});

test('a later unanswered call does not erase sales progress', () => {
  for (const stage of ['interested', 'meeting_booked', 'proposal_sent']) {
    assert.equal(projectOutcome({ id: 1, contactStatus: stage }, input(), now).contactStatus, stage);
  }
  assert.equal(projectOutcome({ id: 1, contactStatus: 'new' }, input(), now).contactStatus, 'follow_up');
});

test('meetings and wins retain milestones, while closed outcomes remove active reminders', () => {
  const meetingAt = '2026-10-19T17:00:00.000Z';
  const meeting = projectOutcome(
    { id: 1, contactStatus: 'interested' },
    input({ disposition: 'meeting_booked', meetingAt }),
    now,
  );
  assert.equal(meeting.contactStatus, 'meeting_booked');
  assert.equal(meeting.firstMeetingAt, now.toISOString());
  assert.equal(meeting.nextFollowUpAt, meetingAt);
  const win = projectOutcome(
    { id: 1, contactStatus: 'proposal_sent' },
    input({ disposition: 'won', valueCents: 250000 }),
    now,
  );
  assert.equal(win.wonValueCents, 250000);
  assert.equal(win.nextFollowUpAt, null);
  assert.equal(win.meetingAt, null);
  assert.throws(() => projectOutcome({ id: 1, contactStatus: 'do_not_call' }, input(), now), /opted out/);
  assert.throws(() => projectOutcome({ id: 1, contactStatus: 'won' }, input(), now), /Reopen/);
});

const range = { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z' };
const activity = (extra: Partial<Activity> = {}): Activity => ({
  leadId: 1,
  kind: 'call',
  disposition: 'no_answer',
  occurredAt: '2026-10-17T01:00:00Z',
  callerId: 1,
  city: 'Regina',
  ...extra,
});
test('analytics separates attempts, distinct businesses, human connections and manual milestones', () => {
  const events = [
    activity({}),
    activity({ disposition: 'interested' }),
    activity({ kind: 'stage_update', disposition: 'meeting_booked' }),
    activity({ kind: 'stage_update', disposition: 'meeting_booked' }),
    activity({ kind: 'stage_update', disposition: 'won', valueCents: 200000 }),
    activity({ kind: 'stage_update', disposition: 'won', valueCents: 200000 }),
    activity({
      leadId: 2,
      isDemo: true,
      disposition: 'won',
      valueCents: 900000,
    }),
    activity({ kind: 'note', disposition: 'won', valueCents: 900000 }),
    activity({ leadId: 3, occurredAt: range.to }),
  ];
  const result = summarize([], events, range, now);
  assert.equal(result.metrics.callAttempts, 2);
  assert.equal(result.metrics.uniqueBusinessesCalled, 1);
  assert.equal(result.metrics.connectionRate, 0.5);
  assert.equal(result.metrics.meetingsBooked, 1);
  assert.equal(result.metrics.projectsWon, 1);
  assert.equal(result.metrics.wonValueCents, 200000);
  assert.deepEqual(result.byDay, { '2026-10-16': 2 });
});

test('historical call attribution survives reassignment, and the conversion rate uses a stated cohort', () => {
  const leads = [
    {
      id: 1,
      city: 'Regina',
      assignedToUserId: 2,
      firstMeetingAt: '2026-10-05T10:00:00Z',
      wonAt: '2026-10-12T10:00:00Z',
    },
    {
      id: 2,
      city: 'Regina',
      assignedToUserId: 2,
      firstMeetingAt: '2026-10-06T10:00:00Z',
      nextFollowUpAt: '2026-10-16T10:00:00Z',
      contactStatus: 'interested',
    },
    {
      id: 3,
      city: 'Calgary',
      assignedToUserId: 2,
      nextFollowUpAt: '2026-10-16T10:00:00Z',
      contactStatus: 'do_not_call',
    },
  ];
  const historical = summarize(leads, [activity({})], { ...range, callerId: 1 }, now);
  assert.equal(historical.metrics.callAttempts, 1);
  assert.equal(historical.metrics.meetingCohort, 0);
  const current = summarize(leads, [activity({})], { ...range, callerId: 2, city: 'Regina' }, now);
  assert.equal(current.metrics.callAttempts, 0);
  assert.equal(current.metrics.meetingToWinConversion, 0.5);
  assert.equal(current.metrics.overdueFollowUps, 1);
  assert.equal(summarize([], [], range, now).metrics.connectionRate, null);
  assert.throws(() => summarize([], [], { from: 'bad', to: 'bad' }), /valid analytics range/);
});
