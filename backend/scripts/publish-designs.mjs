import { context, withWorkerLock } from './context.mjs'
import { backendRoot } from './environment.mjs'
import { publishReviewedDesigns } from '../src/design-sharing.mjs'

await withWorkerLock(async () => {
  const { crm, env } = await context()
  const result = await publishReviewedDesigns(crm, { backendRoot, publicSiteUrl: env.PUBLIC_SITE_URL })
  console.log(JSON.stringify(result))
  if (result.failed) process.exitCode = 1
})
