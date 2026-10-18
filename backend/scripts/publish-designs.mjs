import { createObjectStore } from '../services/object-storage/index.mjs'
import { context, withWorkerLock } from './context.mjs'
import { publishReviewedDesigns } from '../src/design-sharing.mjs'

await withWorkerLock(async () => {
  const { crm, env } = await context()
  const store = createObjectStore(env)
  const result = await publishReviewedDesigns(crm, { store, publicSiteUrl: env.PUBLIC_SITE_URL })
  console.log(JSON.stringify(result))
  if (result.failed) process.exitCode = 1
})
