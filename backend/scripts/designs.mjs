import { createObjectStore } from '../services/object-storage/index.mjs'
import { context, withWorkerLock } from './context.mjs'
import { backendRoot } from './environment.mjs'
import { queueConcepts, runDesignQueue } from '../src/pipeline.mjs'
import { renderConcept } from '../src/designer.mjs'
import { qualify } from '../src/leads.mjs'

await withWorkerLock(async () => {
  const { crm, env, pilot } = await context()
  const store = createObjectStore(env)
  // Repair an interrupted enqueue operation without creating duplicate job keys.
  const pending = await crm.list('six_leads', { qualifiedAt: { $not: null }, designStatus: 'not_queued' }, { paginate: false })
  for (const lead of pending) if (qualify(lead, pilot).qualified) await queueConcepts(crm, lead, pilot, { publicSiteUrl: env.PUBLIC_SITE_URL })
  const result = await runDesignQueue(crm, pilot, (job, lead) => renderConcept(job, lead, { backendRoot, env, store }), { publicSiteUrl: env.PUBLIC_SITE_URL })
  console.log(JSON.stringify(result))
  if (result.failed) process.exitCode = 1
})
