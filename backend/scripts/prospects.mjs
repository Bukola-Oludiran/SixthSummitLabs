import { createObjectStore } from '../services/object-storage/index.mjs'
import { createServer } from 'node:http'
import { context, withWorkerLock } from './context.mjs'
import { publishReviewedDesigns } from '../src/design-sharing.mjs'
import { prospectHandler } from '../src/prospect-http.mjs'

const { crm, env } = await context()
const store = env.DESIGN_S3_BUCKET ? createObjectStore(env) : undefined
if (!store) console.log('S3 is not configured; galleries remain available, but no design files are served from local disk.')
let syncing = false
async function sync() {
  if (syncing) return
  syncing = true
  try {
    await withWorkerLock(async () => {
      const result = await publishReviewedDesigns(crm, { store, publicSiteUrl: env.PUBLIC_SITE_URL })
      if (result.failed) console.error('Some reviewed designs could not be published. Check the S3 configuration and uploaded design bundles.')
    })
  } catch {
    // A lead/design worker may hold the shared lock. Try again on the next interval.
    console.error('Design publication sync deferred; check CRM availability and the worker lock if this persists.')
  } finally { syncing = false }
}
await sync()
const timer = setInterval(sync, 30000)
const server = createServer(prospectHandler({ crm, store }))
server.listen(Number(env.PROSPECT_PORT || 13010), '127.0.0.1', () => console.log('Prospect design service is ready on loopback.'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(timer); server.close() })
