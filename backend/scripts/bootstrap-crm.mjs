import { environment } from './environment.mjs'
import { NocoBaseClient } from '../src/crm.mjs'
import { collections, leadRelations } from '../src/schema.mjs'
import { bootstrapPages } from '../src/crm-pages.mjs'

const env = await environment()
const crm = new NocoBaseClient({ url: env.NOCOBASE_URL || 'http://127.0.0.1:13000/crm', token: env.NOCOBASE_API_KEY })
if (!crm.token) await crm.signIn(env.INIT_ROOT_EMAIL, env.INIT_ROOT_PASSWORD)
const existing = await crm.list('collections', {}, { paginate: false })
const names = new Set(existing.map((entry) => entry.name))
for (const definition of collections) {
  if (names.has(definition.name)) {
    const fields = await crm.list(`collections/${definition.name}/fields`, {}, { paginate: false })
    const byName = new Map(fields.map((field) => [field.name, field]))
    for (const field of definition.fields) {
      if (!byName.has(field.name)) await crm.create(`collections/${definition.name}/fields`, field)
      else if (field.uiSchema?.enum) await crm.request(`collections/${definition.name}/fields`, 'update', { query: { filterByTk: field.name }, body: { uiSchema: field.uiSchema } })
    }
    console.log(`Synced ${definition.name}.`)
  } else {
    await crm.create('collections', definition)
    console.log(`Created ${definition.name}.`)
  }
}
const fields = await crm.list('collections/six_leads/fields', {}, { paginate: false })
const fieldNames = new Set(fields.map((field) => field.name))
for (const relation of leadRelations) {
  if (!fieldNames.has(relation.name)) await crm.create('collections/six_leads/fields', relation)
}
console.log('Lead, evidence, brand, concept, call and daily-run collections are ready.')
await bootstrapPages(crm, { crmPublicPath: env.APP_PUBLIC_PATH || '/crm/' })
console.log('CRM pages are ready in the NocoBase sidebar.')
const callerRoles = await crm.list('roles', { name: 'sixsummit_caller' })
if (!callerRoles.length) await crm.create('roles', { name: 'sixsummit_caller', title: '6ixSummit Caller', snippets: ['ui.sixsummit-crm'], allowConfigure: false, allowNewMenu: false })
const routes = await crm.list('desktopRoutes', { menuSchemaUid: 'sixsummit-workspace-link' })
if (routes[0]) await crm.request('roles/sixsummit_caller/desktopRoutes', 'add', { body: [routes[0].id] })
console.log('6ixSummit Caller role is ready; assign it to each caller account.')
