import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { context, withWorkerLock } from './context.mjs'
import { backendRoot } from './environment.mjs'
import { discover } from '../src/sources/overpass.mjs'
import { checkWebsite } from '../src/sources/search.mjs'
import { ingestCandidates, budgetDate } from '../src/pipeline.mjs'

const [command, filename] = process.argv.slice(2)
if (!['discover', 'import', 'verify'].includes(command)) throw new Error('Use leads.mjs discover | import candidates.json | verify candidates.json')
await withWorkerLock(async () => {
  const { env, pilot, crm } = await context()
  let candidates = []
  const errors = []
  if (command === 'discover') {
    // Three city requests run sequentially; do not overload a shared open-data service.
    for (const city of pilot.cities) {
      try { candidates.push(...await discover(city, { endpoint: env.OVERPASS_URL || undefined })) }
      catch (error) { errors.push({ city: city.name, error: error.message }) }
    }
  } else {
    if (!filename) throw new Error('Provide a local JSON array of researched candidates.')
    candidates = JSON.parse(await readFile(filename, 'utf8'))
    if (!Array.isArray(candidates)) throw new Error('Expected an array of business observations.')
  }
  if (command === 'verify') {
    if (!env.SEARXNG_URL) throw new Error('SEARXNG_URL is not configured. Import reviewed evidence or configure your own permitted JSON search instance.')
    const checked = []
    for (const candidate of candidates) checked.push(await checkWebsite(candidate, { endpoint: env.SEARXNG_URL }))
    candidates = checked
  }
  const folder = path.join(backendRoot, 'storage/discovery')
  await mkdir(folder, { recursive: true, mode: 0o700 })
  const runKey = `${Date.now()}-${process.pid}`
  await writeFile(path.join(folder, `${runKey}.json`), JSON.stringify(candidates, null, 2), { mode: 0o600 })
  const run = await crm.create('six_runs', { runKey, budgetDate: budgetDate(), target: pilot.dailyQualifiedLeadTarget, qualifiedCount: 0, status: 'running', startedAt: new Date().toISOString() })
  try {
    const summary = { ...await ingestCandidates(crm, candidates, pilot), sourceErrors: errors }
    await crm.update('six_runs', run.id, { status: errors.length ? 'failed' : 'finished', qualifiedCount: summary.qualified, finishedAt: new Date().toISOString(), summary })
    console.log(JSON.stringify(summary, null, 2))
    if (errors.length) process.exitCode = 1
  } catch (error) {
    await crm.update('six_runs', run.id, { status: 'failed', finishedAt: new Date().toISOString(), summary: { error: error.message } })
    throw error
  }
})
