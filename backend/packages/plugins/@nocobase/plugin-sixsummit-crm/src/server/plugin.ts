import { Plugin } from '@nocobase/server';
import type { Context } from '@nocobase/actions';
import { guarded, recordOutcome, analytics, worklist, assign, reopen, dispositionOptions, callers } from './actions';
import { leads, detail, note, sharing, reviewDesign } from './workspace';

export class PluginSixsummitCrmServer extends Plugin {
  async load() {
    this.app.resourceManager.define({
      name: 'six_crm',
      actions: {
        recordOutcome: (ctx: Context) => guarded(ctx, () => recordOutcome(ctx)),
        summary: (ctx: Context) => guarded(ctx, () => analytics(ctx)),
        worklist: (ctx: Context) => guarded(ctx, () => worklist(ctx)),
        assign: (ctx: Context) => guarded(ctx, () => assign(ctx)),
        reopen: (ctx: Context) => guarded(ctx, () => reopen(ctx)),
        dispositions: (ctx: Context) => guarded(ctx, async () => dispositionOptions()),
        callers: (ctx: Context) => guarded(ctx, () => callers(ctx)),
        leads: (ctx: Context) => guarded(ctx, () => leads(ctx)),
        detail: (ctx: Context) => guarded(ctx, () => detail(ctx)),
        note: (ctx: Context) => guarded(ctx, () => note(ctx)),
        sharing: (ctx: Context) => guarded(ctx, () => sharing(ctx)),
        reviewDesign: (ctx: Context) => guarded(ctx, () => reviewDesign(ctx)),
      },
    });
    this.app.acl.registerSnippet({
      name: 'ui.sixsummit-crm',
      actions: [
        'six_crm:recordOutcome',
        'six_crm:summary',
        'six_crm:worklist',
        'six_crm:assign',
        'six_crm:dispositions',
        'six_crm:callers',
        'six_crm:leads',
        'six_crm:detail',
        'six_crm:note',
        'six_crm:sharing',
      ],
    });
    this.app.acl.registerSnippet({
      name: 'ui.sixsummit-crm-admin',
      actions: ['six_crm:reopen', 'six_crm:reviewDesign'],
    });
    const protectedFields = new Set([
      'contactStatus',
      'lastDisposition',
      'lastContactAt',
      'nextFollowUpAt',
      'meetingAt',
      'firstMeetingAt',
      'wonAt',
      'wonValueCents',
      'lostAt',
      'lossReason',
      'optedOutAt',
      'assignedToUserId',
      'assignedTo',
    ]);
    this.app.resourceManager.use(
      async (ctx, next) => {
        const { resourceName, actionName, params } = ctx.action;
        const values = (params.values || {}) as Record<string, unknown>;
        const protectedLeadWrite =
          resourceName === 'six_leads' &&
          actionName === 'update' &&
          Object.keys(values).some((key) => protectedFields.has(key));
        const protectedEventWrite =
          resourceName === 'six_activities' &&
          (['update', 'destroy'].includes(actionName) ||
            (actionName === 'create' && (values.kind !== 'note' || values.disposition !== undefined)));
        if (protectedLeadWrite || protectedEventWrite)
          ctx.throw(
            409,
            ctx.t('Use the CRM flow actions to preserve activity history', {
              ns: this.name,
            }),
          );
        await next();
      },
      { group: 'sixsummit-flow', after: 'acl', before: 'data' },
    );
  }
}

export default PluginSixsummitCrmServer;
