import { createHash } from 'node:crypto';
import type { Context } from '@nocobase/actions';
import {
  FlowError,
  normalizeOutcome,
  projectOutcome,
  summarize,
  dispositions,
  type Lead,
  type Activity,
} from './domain';

interface Actor {
  id: number;
  username: string;
  nickname?: string;
}
const actor = (ctx: Context): Actor => {
  const user = ctx.state.currentUser as Actor | undefined;
  if (!user?.id) ctx.throw(401);
  return user;
};
const root = (ctx: Context) =>
  (ctx.state.currentRoles as string[] | undefined)?.includes('root') || ctx.state.currentRole === 'root';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const values = (ctx: Context) => (ctx.action.params.values || {}) as Record<string, unknown>;
function fail(message: string, status = 422): never {
  throw new FlowError(message, status);
}
export async function guarded(ctx: Context, work: () => Promise<unknown>) {
  try {
    actor(ctx);
    ctx.body = await work();
  } catch (error) {
    if (error instanceof FlowError)
      ctx.throw(error.status, ctx.t(error.code, { ns: '@nocobase/plugin-sixsummit-crm' }));
    if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError')
      ctx.throw(
        409,
        ctx.t('This requestId was already used for a different outcome', {
          ns: '@nocobase/plugin-sixsummit-crm',
        }),
      );
    throw error;
  }
}

export async function recordOutcome(ctx: Context) {
  if (ctx.method !== 'POST') ctx.throw(405);
  const user = actor(ctx);
  const data = values(ctx);
  if (typeof data.leadId !== 'number' || !Number.isSafeInteger(data.leadId)) fail('A valid leadId is required');
  return ctx.db.sequelize.transaction(async (transaction) => {
    const leadModel = await ctx.db.getModel('six_leads').findByPk(data.leadId as number, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!leadModel) fail('Lead not found', 404);
    const lead = leadModel.toJSON() as Lead;
    if (!root(ctx) && lead.assignedToUserId !== user.id)
      fail('Assign this lead to yourself before recording an outcome', 403);
    const repository = ctx.db.getRepository('six_activities');
    const previous =
      typeof data.requestId === 'string'
        ? await repository.findOne({
            filter: { requestId: data.requestId },
            transaction,
          })
        : null;
    const input = normalizeOutcome(data, previous ? new Date(previous.get('occurredAt') as string) : new Date());
    const payloadHash = hash({ ...input, callerId: user.id });
    if (previous) {
      if (previous.get('payloadHash') !== payloadHash || previous.get('leadId') !== lead.id)
        fail('This requestId was already used for a different outcome', 409);
      return { activity: previous, lead, replayed: true };
    }
    const now = new Date();
    const patch = projectOutcome(lead, input, now);
    const activity = await repository.create({
      values: {
        ...input,
        payloadHash,
        callerId: user.id,
        caller: user.nickname || user.username,
        city: lead.city,
        occurredAt: now.toISOString(),
        fromStage: lead.contactStatus,
        toStage: patch.contactStatus,
        currency: 'CAD',
        isDemo: Boolean(lead.isDemo),
      },
      transaction,
      context: ctx,
    });
    await ctx.db.getRepository('six_leads').update({
      filterByTk: lead.id,
      values: patch,
      transaction,
      context: ctx,
    });
    return { activity, lead: { ...lead, ...patch }, replayed: false };
  });
}

export async function assign(ctx: Context) {
  if (ctx.method !== 'POST') ctx.throw(405);
  const user = actor(ctx);
  const data = values(ctx);
  const assignedToUserId = data.userId === undefined ? user.id : Number(data.userId);
  if (!Number.isSafeInteger(assignedToUserId) || assignedToUserId <= 0) fail('A valid caller is required');
  if (!root(ctx) && assignedToUserId !== user.id) fail('Only an administrator can assign another caller', 403);
  return ctx.db.sequelize.transaction(async (transaction) => {
    const row = await ctx.db.getModel('six_leads').findByPk(Number(data.leadId), {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) fail('Lead not found', 404);
    const lead = row.toJSON() as Lead;
    if (['won', 'lost', 'do_not_call', 'invalid_contact'].includes(lead.contactStatus || ''))
      fail('Closed leads cannot be assigned', 409);
    if (!root(ctx) && lead.assignedToUserId && lead.assignedToUserId !== user.id)
      fail('This lead is assigned to another caller', 409);
    const assignee = await ctx.db.getRepository('users').findOne({ filterByTk: assignedToUserId, transaction });
    if (!assignee) fail('Caller not found', 404);
    const patch = {
      assignedToUserId,
      assignedTo: String(assignee.get('nickname') || assignee.get('username')),
      contactStatus: lead.contactStatus === 'new' ? 'assigned' : lead.contactStatus,
    };
    await ctx.db.getRepository('six_leads').update({
      filterByTk: lead.id,
      values: patch,
      transaction,
      context: ctx,
    });
    if (lead.assignedToUserId !== assignedToUserId)
      await ctx.db.getRepository('six_activities').create({
        values: {
          leadId: lead.id,
          kind: 'assignment',
          callerId: user.id,
          caller: user.nickname || user.username,
          occurredAt: new Date().toISOString(),
          notes: patch.assignedTo,
          city: lead.city,
          isDemo: Boolean(lead.isDemo),
        },
        transaction,
        context: ctx,
      });
    return { ...lead, ...patch };
  });
}

export async function reopen(ctx: Context) {
  if (ctx.method !== 'POST') ctx.throw(405);
  if (!root(ctx)) fail('Only an administrator can reopen a lead', 403);
  const user = actor(ctx);
  const data = values(ctx);
  const reason = data.reason;
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 1000)
    fail('A reopen reason is required');
  return ctx.db.sequelize.transaction(async (transaction) => {
    const row = await ctx.db.getModel('six_leads').findByPk(Number(data.leadId), {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) fail('Lead not found', 404);
    const lead = row.toJSON() as Lead;
    if (lead.contactStatus === 'do_not_call') fail('An opt-out cannot be reopened through this action', 409);
    if (!['won', 'lost', 'invalid_contact'].includes(lead.contactStatus || '')) fail('This lead is already open', 409);
    await ctx.db.getRepository('six_activities').create({
      values: {
        leadId: lead.id,
        kind: 'reopen',
        callerId: user.id,
        caller: user.nickname || user.username,
        occurredAt: new Date().toISOString(),
        notes: reason.trim(),
        fromStage: lead.contactStatus,
        toStage: 'follow_up',
        city: lead.city,
        isDemo: Boolean(lead.isDemo),
      },
      transaction,
      context: ctx,
    });
    const patch = {
      contactStatus: 'follow_up',
      nextFollowUpAt: null,
      meetingAt: null,
    };
    await ctx.db.getRepository('six_leads').update({
      filterByTk: lead.id,
      values: patch,
      transaction,
      context: ctx,
    });
    return { ...lead, ...patch };
  });
}

export async function analytics(ctx: Context) {
  const now = new Date();
  const params = ctx.action.params;
  const filter = {
    from: String(params.from || new Date(now.getTime() - 30 * 86400000).toISOString()),
    to: String(params.to || now.toISOString()),
    city: params.city ? String(params.city) : undefined,
    callerId: params.callerId ? Number(params.callerId) : undefined,
  };
  if (filter.callerId !== undefined && (!Number.isSafeInteger(filter.callerId) || filter.callerId <= 0))
    fail('A valid caller is required');
  summarize([], [], filter, now);
  const leads = await ctx.db.getRepository('six_leads').find({ filter: { isDemo: { $ne: true } } });
  const events = await ctx.db.getRepository('six_activities').find({
    filter: {
      occurredAt: { $gte: filter.from, $lt: filter.to },
      isDemo: { $ne: true },
    },
    sort: ['occurredAt', 'id'],
  });
  return summarize(
    leads.map((row) => row.toJSON() as Lead),
    events.map((row) => row.toJSON() as Activity),
    filter,
    now,
  );
}

export async function worklist(ctx: Context) {
  const user = actor(ctx);
  const filter: Record<string, unknown> = {
    isDemo: { $ne: true },
    qualifiedAt: { $not: null },
    contactStatus: {
      $notIn: ['won', 'lost', 'invalid_contact', 'do_not_call'],
    },
  };
  if (!root(ctx)) filter.$or = [{ assignedToUserId: user.id }, { assignedToUserId: null }];
  if (ctx.action.params.city) filter.city = String(ctx.action.params.city);
  return ctx.db.getRepository('six_leads').find({ filter, sort: ['-priority', 'nextFollowUpAt', 'id'], limit: 100 });
}

export function dispositionOptions() {
  return Object.entries(dispositions).map(([value, details]) => ({
    value,
    ...details,
  }));
}

export async function callers(ctx: Context) {
  const users = await ctx.db.getRepository('users').find({
    filter: { 'roles.name': { $in: ['root', 'sixsummit_caller'] } },
    fields: ['id', 'username', 'nickname'],
    sort: ['id'],
  });
  return users.map((user) => ({
    id: user.get('id'),
    name: user.get('nickname') || user.get('username'),
  }));
}
