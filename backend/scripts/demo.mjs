import { readFile } from 'node:fs/promises'
import { environment, backendRoot } from './environment.mjs'
import { conceptBriefs } from '../src/leads.mjs'
import { prepareConcept } from '../src/designer.mjs'

const env = await environment()
const lead = JSON.parse(await readFile(new URL('../test/fixtures/demo-business.json', import.meta.url), 'utf8'))
const pilot = JSON.parse(await readFile(new URL('../config/pilot.json', import.meta.url), 'utf8'))
console.log('Preparing three fictional freeform design briefs; no CRM records or lead quota will be changed.')
for (const job of conceptBriefs(lead, pilot)) {
  const result = await prepareConcept(job, lead, { backendRoot, env })
  console.log(JSON.stringify({ concept: job.conceptNumber, source: result.source }))
}
