import { createServer } from 'node:http'
import { context, withWorkerLock } from './context.mjs'
import { backendRoot } from './environment.mjs'
import { publishReviewedDesigns } from '../src/design-sharing.mjs'
import { prospectHandler } from '../src/prospect-http.mjs'

const { crm, env } = await context()
let syncing = false
async function sync() {
  if (syncing) return
  syncing = true
  try {
    await withWorkerLock(async () => {
      const result = await publishReviewedDesigns(crm, { backendRoot, publicSiteUrl: env.PUBLIC_SITE_URL })
      if (result.failed) console.error('Some reviewed designs could not be published. Check their local asset paths.')
    })
  } catch {
    // A lead/design worker may hold the shared lock. Try again on the next interval.
    console.error('Design publication sync deferred; check CRM availability and the worker lock if this persists.')
  } finally { syncing = false }
}
await sync()
const timer = setInterval(sync, 30000)
const server = createServer(prospectHandler({ crm, backendRoot }))
server.listen(Number(env.PROSPECT_PORT || 13010), '127.0.0.1', () => console.log('Prospect design service is ready on loopback.'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(timer); server.close() })
