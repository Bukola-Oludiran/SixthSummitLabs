import { createHash } from 'node:crypto';
import type { Context } from '@nocobase/actions';
import { actor, root } from './actions';
import { FlowError } from './domain';

const closed = ['won', 'lost', 'invalid_contact', 'do_not_call'];
const stages = ['new', 'assigned', 'called', 'follow_up', 'interested', 'meeting_booked', 'proposal_sent', ...closed];
const values = (ctx: Context) => (ctx.action.params.values || {}) as Record<string, unknown>;
const id = (value: unknown) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new FlowError('A valid leadId is required');
  return number;
};
const visibility = (ctx: Context) =>
  root(ctx) ? {} : { $or: [{ assignedToUserId: actor(ctx).id }, { assignedToUserId: null }] };

async function visibleLead(ctx: Context, leadId: unknown, write = false) {
  const row = await ctx.db.getRepository('six_leads').findOne({
    filter: { $and: [{ id: id(leadId) }, visibility(ctx)] },
  });
  if (!row) throw new FlowError('Lead not found', 404);
  if (write && !root(ctx) && row.get('assignedToUserId') !== actor(ctx).id)
    throw new FlowError('Assign this lead to yourself before recording an outcome', 403);
  return row;
}

export async function leads(ctx: Context) {
  const params = ctx.action.params;
  const page = Math.max(1, Math.min(100000, Number(params.page) || 1));
  const pageSize = 20;
  const filters: Record<string, unknown>[] = [visibility(ctx)];
  if (params.showDemo === 'true') {
    if (!root(ctx)) throw new FlowError('Only an administrator can view demonstration records', 403);
    filters.push({ isDemo: true });
  } else filters.push({ isDemo: { $ne: true } });
  if (params.city) filters.push({ city: String(params.city).slice(0, 80) });
  if (params.stage && stages.includes(String(params.stage))) filters.push({ contactStatus: params.stage });
  if (params.search) {
    const search = String(params.search).trim().slice(0, 100);
    filters.push({ $or: [{ businessName: { $includes: search } }, { phone: { $includes: search } }] });
  }
  if (params.owner === 'me') filters.push({ assignedToUserId: actor(ctx).id });
  else if (params.owner === 'unassigned') filters.push({ assignedToUserId: null });
  else if (params.owner) filters.push({ assignedToUserId: id(params.owner) });
  if (params.queue === 'callable') filters.push({ qualifiedAt: { $not: null }, contactStatus: { $notIn: closed } });
  if (params.queue === 'follow_up') filters.push({ nextFollowUpAt: { $not: null }, contactStatus: { $notIn: closed } });
  if (params.queue === 'designs') filters.push({ designStatus: { $ne: 'not_queued' } });
  const [rows, total] = await ctx.db.getRepository('six_leads').findAndCount({
    filter: { $and: filters },
    sort: params.queue === 'follow_up' ? ['nextFollowUpAt', 'id'] : ['-priority', '-createdAt', '-id'],
    limit: pageSize,
    offset: (Math.floor(page) - 1) * pageSize,
  });
  return { items: rows, total, page: Math.floor(page), pageSize };
}

export async function detail(ctx: Context) {
  const lead = await visibleLead(ctx, ctx.action.params.leadId);
  const leadId = lead.get('id');
  const [activities, concepts, sources] = await Promise.all([
    ctx.db.getRepository('six_activities').find({ filter: { leadId }, sort: ['-occurredAt', '-id'], limit: 100 }),
    ctx.db
      .getRepository('six_concepts')
      .find({ filter: { leadId, briefVersion: lead.get('briefVersion') || 1 }, sort: ['conceptNumber'] }),
    ctx.db.getRepository('six_sources').find({ filter: { leadId }, sort: ['-observedAt'], limit: 100 }),
  ]);
  return { lead, activities, concepts, sources };
}

export async function note(ctx: Context) {
  if (ctx.method !== 'POST') ctx.throw(405);
  const input = values(ctx);
  const lead = await visibleLead(ctx, input.leadId, true);
  if (typeof input.notes !== 'string' || !input.notes.trim() || input.notes.length > 10000)
    throw new FlowError('A note of up to 10000 characters is required');
  if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestId))
    throw new FlowError('A stable requestId is required');
  const user = actor(ctx);
  const notes = input.notes.trim();
  const requestId = input.requestId;
  const payloadHash = createHash('sha256')
    .update(JSON.stringify({ leadId: lead.get('id'), callerId: user.id, notes }))
    .digest('hex');
  return ctx.db.sequelize.transaction(async (transaction) => {
    // Serialize note retries against the same lead, as the outcome action does.
    const current = await ctx.db
      .getModel('six_leads')
      .findByPk(lead.get('id'), { transaction, lock: transaction.LOCK.UPDATE });
    if (!current || (!root(ctx) && current.get('assignedToUserId') !== user.id))
      throw new FlowError('Assign this lead to yourself before recording an outcome', 403);
    const repository = ctx.db.getRepository('six_activities');
    const previous = await repository.findOne({ filter: { requestId }, transaction });
    if (previous) {
      if (previous.get('payloadHash') !== payloadHash || previous.get('kind') !== 'note')
        throw new FlowError('This requestId was already used for a different outcome', 409);
      return previous;
    }
    return repository.create({
      values: {
        leadId: lead.get('id'),
        kind: 'note',
        notes,
        requestId,
        payloadHash,
        callerId: user.id,
        caller: user.nickname || user.username,
        occurredAt: new Date().toISOString(),
        city: lead.get('city'),
        isDemo: Boolean(lead.get('isDemo')),
      },
      transaction,
      context: ctx,
    });
  });
}

export async function sharing(ctx: Context) {
  if (ctx.method !== 'POST') ctx.throw(405);
  const input = values(ctx);
  const lead = await visibleLead(ctx, input.leadId, true);
  if (typeof input.enabled !== 'boolean') throw new FlowError('A sharing preference is required');
  return ctx.db.sequelize.transaction(async (transaction) => {
    const current = await ctx.db
      .getModel('six_leads')
      .findByPk(lead.get('id'), { transaction, lock: transaction.LOCK.UPDATE });
    if (!current || (!root(ctx) && current.get('assignedToUserId') !== actor(ctx).id))
      throw new FlowError('Assign this lead to yourself before recording an outcome', 403);
    await ctx.db.getRepository('six_leads').update({
      filterByTk: lead.get('id'),
      values: { designSharingEnabled: input.enabled },
      transaction,
      context: ctx,
    });
    return { designSharingEnabled: input.enabled };
  });
}

export async function reviewDesign(ctx: Context) {
  if (ctx.method !== 'POST') ctx.throw(405);
  if (!root(ctx)) throw new FlowError('Only an administrator can review designs', 403);
  const input = values(ctx);
  const lead = await visibleLead(ctx, input.leadId);
  const status = input.status;
  if (!['ready', 'needs_review'].includes(String(status))) throw new FlowError('Invalid design review');
  return ctx.db.sequelize.transaction(async (transaction) => {
    const current = await ctx.db
      .getModel('six_leads')
      .findByPk(lead.get('id'), { transaction, lock: transaction.LOCK.UPDATE });
    if (!current) throw new FlowError('Lead not found', 404);
    const repository = ctx.db.getRepository('six_concepts');
    const job = await repository.findOne({
      filter: { id: id(input.conceptId), leadId: lead.get('id'), briefVersion: current.get('briefVersion') || 1 },
      transaction,
    });
    if (!job || !['needs_review', 'ready'].includes(String(job.get('status'))))
      throw new FlowError('The design is not ready for review', 409);
    const findings = job.get('findings') as { ok?: boolean; findingCount?: number } | null;
    if (
      status === 'ready' &&
      (input.reviewed !== true ||
        !String(job.get('artifactManifest') || '').startsWith('s3://') ||
        !findings?.ok ||
        findings.findingCount !== 0)
    )
      throw new FlowError('Review the uploaded design and its passing checks before approval', 422);
    if (job.get('status') === status) return job;
    await repository.update({ filterByTk: job.get('id'), values: { status }, transaction, context: ctx });
    await ctx.db.getRepository('six_activities').create({
      values: {
        leadId: lead.get('id'),
        kind: 'note',
        notes: `${ctx.t('Design review', { ns: '@nocobase/plugin-sixsummit-crm' })}: ${job.get(
          'conceptNumber',
        )} — ${ctx.t(status === 'ready' ? 'Design approved' : 'Design returned to review', {
          ns: '@nocobase/plugin-sixsummit-crm',
        })}`,
        callerId: actor(ctx).id,
        caller: actor(ctx).nickname || actor(ctx).username,
        occurredAt: new Date().toISOString(),
        city: lead.get('city'),
        isDemo: Boolean(lead.get('isDemo')),
      },
      transaction,
      context: ctx,
    });
    const jobs = await repository.find({
      filter: { leadId: lead.get('id'), briefVersion: current.get('briefVersion') || 1 },
      transaction,
    });
    const designStatus = jobs.some((row) => row.get('status') === 'failed')
      ? 'failed'
      : jobs.length === 3 && jobs.every((row) => row.get('status') === 'ready')
        ? 'ready'
        : 'needs_review';
    await ctx.db
      .getRepository('six_leads')
      .update({ filterByTk: lead.get('id'), values: { designStatus }, transaction, context: ctx });
    return { id: job.get('id'), status };
  });
}
