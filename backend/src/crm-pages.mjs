import { collections } from './schema.mjs'

const views = [
  { collection: 'six_leads', title: 'Leads', columns: ['businessName', 'phone', 'city', 'category', 'websiteStatus', 'qualifiedAt', 'logoStatus', 'contactStatus', 'assignedTo', 'nextFollowUpAt', 'designStatus', 'designShareUrl', 'designSharingEnabled'], edit: ['businessNotes', 'logoStatus', 'logoAssetPath', 'brandPalette', 'motifs', 'services', 'websiteStatus', 'websiteCheckedAt', 'websiteEvidence', 'designSharingEnabled'] },
  { collection: 'six_concepts', title: 'Homepage concepts', columns: ['lead', 'conceptNumber', 'direction', 'status', 'previewUrl', 'publishedAt', 'archetype', 'htmlPath', 'desktopPath', 'mobilePath', 'error'], edit: ['status'] },
  { collection: 'six_activities', title: 'Calls and follow-ups', columns: ['lead', 'kind', 'disposition', 'caller', 'occurredAt', 'notes', 'followUpAt'] },
  { collection: 'six_sources', title: 'Lead evidence', columns: ['lead', 'sourceName', 'sourceUrl', 'observedAt', 'facts', 'attribution'] },
  { collection: 'six_brand_assets', title: 'Brand assets', columns: ['lead', 'kind', 'sourceUrl', 'path', 'colours', 'notes'] },
  { collection: 'six_runs', title: 'Daily runs', columns: ['budgetDate', 'target', 'qualifiedCount', 'status', 'startedAt', 'finishedAt', 'summary'] },
]

function editAction(view) {
  const fields = Object.fromEntries(view.edit.map((name) => [name, { 'x-component': 'CollectionField', 'x-decorator': 'FormItem', 'x-collection-field': `${view.collection}.${name}` }]))
  return {
    type: 'void', title: 'Edit', 'x-action': 'update', 'x-component': 'Action.Link',
    properties: {
      drawer: { type: 'void', title: `Edit ${view.title.toLowerCase()}`, 'x-component': 'Action.Drawer', properties: {
        formBlock: { type: 'void', 'x-component': 'CardItem', 'x-decorator': 'FormBlockProvider', 'x-use-decorator-props': 'useEditFormBlockDecoratorProps', 'x-decorator-props': { collection: view.collection, dataSource: 'main', action: 'get' }, 'x-is-current': true,
          properties: { form: { type: 'void', 'x-component': 'FormV2', 'x-use-component-props': 'useEditFormBlockProps', properties: {
            ...fields,
            actions: { type: 'void', 'x-component': 'ActionBar', properties: {
              submit: { type: 'void', title: 'Save', 'x-component': 'Action', 'x-action': 'submit', 'x-use-component-props': 'useUpdateActionProps', 'x-component-props': { type: 'primary', htmlType: 'submit' } },
            } },
          } } },
        },
      } },
    },
  }
}

export function pageDefinition(view) {
  const uid = `sixsummit-${view.collection}`
  const definition = collections.find((collection) => collection.name === view.collection)
  const columns = Object.fromEntries(view.columns.map((name) => {
    const field = definition.fields.find((entry) => entry.name === name)
    return [`column_${name}`, { type: 'void', title: field?.uiSchema?.title || name, 'x-component': 'TableV2.Column', 'x-decorator': 'TableV2.Column.Decorator', properties: {
      [name]: { 'x-component': 'CollectionField', 'x-collection-field': `${view.collection}.${name}`, 'x-read-pretty': true, 'x-component-props': { ellipsis: true } },
    } }]
  }))
  if (view.edit) columns.actions = { type: 'void', title: 'Actions', 'x-component': 'TableV2.Column', 'x-decorator': 'TableV2.Column.ActionBar', 'x-action-column': 'actions', properties: { edit: editAction(view) } }
  const schema = { type: 'void', 'x-uid': uid, 'x-component': 'Page', properties: {
    tab: { type: 'void', 'x-uid': `${uid}-tab`, 'x-component': 'Grid', 'x-initializer': 'page:addBlock', 'x-async': true, properties: {
      row: { type: 'void', 'x-component': 'Grid.Row', properties: {
        col: { type: 'void', 'x-component': 'Grid.Col', properties: {
          tableBlock: { type: 'void', 'x-decorator': 'TableBlockProvider', 'x-component': 'CardItem', 'x-acl-action': `${view.collection}:list`, 'x-decorator-props': { collection: view.collection, dataSource: 'main', action: 'list', params: { pageSize: 20, sort: ['-createdAt'], ...(['six_leads', 'six_activities'].includes(view.collection) ? { filter: { isDemo: { $ne: true } } } : {}) } }, properties: {
            actions: { type: 'void', 'x-component': 'ActionBar', 'x-initializer': 'table:configureActions', properties: {
              filter: { type: 'void', title: 'Filter', 'x-component': 'Filter.Action', 'x-action': 'filter', 'x-use-component-props': 'useFilterActionProps', 'x-component-props': { icon: 'FilterOutlined' } },
              refresh: { type: 'void', title: 'Refresh', 'x-component': 'Action', 'x-use-component-props': 'useRefreshActionProps' },
            } },
            records: { type: 'array', 'x-component': 'TableV2', 'x-initializer': 'table:configureColumns', 'x-use-component-props': 'useTableBlockProps', 'x-component-props': { rowKey: 'id' }, properties: columns },
          } },
        } },
      } },
    } },
  } }
  const route = { title: view.title, type: 'page', schemaUid: uid, menuSchemaUid: `${uid}-menu`, enableTabs: false, uiLayouts: [{ uid: 'admin-layout-model' }], children: [{ type: 'tabs', schemaUid: `${uid}-tab`, tabSchemaName: 'tab', hidden: true }] }
  return { route, schema }
}

export async function bootstrapPages(crm, { crmPublicPath = '/crm/' } = {}) {
  const existing = await crm.list('desktopRoutes', {}, { paginate: false })
  const workspace = existing.find((route) => route.menuSchemaUid === 'sixsummit-workspace-link')
  const workspaceOptions = { href: `${crmPublicPath.replace(/\/$/, '')}/admin/sixsummit`, openInNewTab: false }
  if (!workspace) await crm.request('desktopRoutes', 'create', { query: { layout: 'admin-layout-model' }, body: { type: 'link', title: 'Call workspace & analytics', menuSchemaUid: 'sixsummit-workspace-link', options: workspaceOptions } })
  else await crm.update('desktopRoutes', workspace.id, { options: workspaceOptions })
  for (const view of views) {
    const { route, schema } = pageDefinition(view)
    if (existing.some((item) => item.schemaUid === route.schemaUid)) {
      const stored = await crm.request('uiSchemas', 'getJsonSchema', { query: { resourceIndex: route.schemaUid, includeAsyncNode: true } })
      const walk = async (node, desired) => {
        const oldCallField = view.collection === 'six_leads' && ['six_leads.contactStatus', 'six_leads.assignedTo', 'six_leads.nextFollowUpAt'].includes(node['x-collection-field']) && node['x-decorator'] === 'FormItem'
        const oldEventEdit = view.collection === 'six_activities' && node['x-action'] === 'update'
        if ((oldCallField || oldEventEdit) && node['x-uid']) {
          await crm.request('uiSchemas', 'remove', { query: { resourceIndex: node['x-uid'] }, body: {} })
          return
        }
        if (node['x-decorator'] === 'TableBlockProvider' && ['six_leads', 'six_activities'].includes(view.collection)) {
          const props = node['x-decorator-props'] || {}
          await crm.request('uiSchemas', 'patch', { body: { 'x-uid': node['x-uid'], 'x-decorator-props': { ...props, params: { ...props.params, filter: { ...props.params?.filter, isDemo: { $ne: true } } } } } })
        }
        // Add new managed table/form fields without replacing a user's configured page.
        if ((node['x-component'] === 'TableV2' || node['x-component'] === 'FormV2') && node['x-uid']) {
          for (const [name, child] of Object.entries(desired?.properties || {})) {
            if (!node.properties?.[name]) await crm.request('uiSchemas', 'insertAdjacent', { query: { resourceIndex: node['x-uid'], position: 'beforeEnd' }, body: { schema: { ...child, name } } })
          }
        }
        for (const [name, child] of Object.entries(node.properties || {})) await walk(child, desired?.properties?.[name])
      }
      await walk(stored.data, schema)
      continue
    }
    const stored = await crm.request('uiSchemas', 'getJsonSchema', { query: { resourceIndex: route.schemaUid } })
    if (!stored.data?.['x-uid']) await crm.request('uiSchemas', 'insert', { body: schema })
    await crm.request('desktopRoutes', 'create', { query: { layout: 'admin-layout-model', updateAssociationValues: ['children'] }, body: route })
  }
}
