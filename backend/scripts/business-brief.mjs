import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { environment, backendRoot } from './environment.mjs'
import { NocoBaseClient } from '../src/crm.mjs'
import { readBusinessBrief } from '../src/business-brief.mjs'

try {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== '--days')) throw new Error('Use business-brief.mjs [--days 7].')
  const env = await environment()
  const pilot = JSON.parse(await readFile(path.join(backendRoot, 'config/pilot.json'), 'utf8'))
  const crm = new NocoBaseClient({ url: env.NOCOBASE_URL || 'http://127.0.0.1:13000/crm', token: env.NOCOBASE_REPORTING_API_KEY || env.NOCOBASE_API_KEY })
  if (!crm.token) await crm.signIn(env.INIT_ROOT_EMAIL, env.INIT_ROOT_PASSWORD)
  const brief = await readBusinessBrief(crm, { pilot, publicSiteUrl: env.PUBLIC_SITE_URL, days: args.length ? Number(args[1]) : 7 })
  console.log(JSON.stringify(brief, null, 2))
} catch {
  console.error('Business briefing unavailable. Check the reporting arguments, local CRM services and backend credentials. No current business figures were produced.')
  process.exitCode = 1
}
