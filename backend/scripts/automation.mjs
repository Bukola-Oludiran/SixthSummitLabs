import { readFile, access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { environment, backendRoot } from './environment.mjs'
import { NocoBaseClient } from '../src/crm.mjs'
import { automationConfiguration, automationStatus, assertAuthorable } from '../src/automation.mjs'
import { prepareConcept } from '../src/designer.mjs'
import { createObjectStore } from '../services/object-storage/index.mjs'
import { withWorkerLock } from './context.mjs'

const [command = 'check', ...args] = process.argv.slice(2)
const profile = path.resolve(process.env.SIXSUMMIT_ENV_FILE || path.join(backendRoot, '.env.automation'))
const commands = {
  discover: ['leads.mjs', 'discover'], import: ['leads.mjs', 'import'],
  designs: ['designs.mjs'], upload: ['storage.mjs', 'upload'],
  asset: ['storage.mjs', 'asset'], restore: ['storage.mjs', 'restore'],
  publish: ['publish-designs.mjs'],
}
let store
try {
  if (!['check', 'status', 'prepare', ...Object.keys(commands)].includes(command)) throw new Error('Unknown automation command.')
  // Only the explicit live profile and ordinary tool/runtime variables are loaded.
  // Local database, administrator and marketing Git credentials are not inherited.
  const inherit = Object.fromEntries(['PATH', 'HOME', 'USER', 'LANG', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].filter(key => process.env[key]).map(key => [key, process.env[key]]))
  const env = await environment({ file: profile, inherit })
  env.SIXSUMMIT_ENV_FILE = profile
  const config = automationConfiguration(env, { storage: !['status', 'discover', 'import'].includes(command) })
  if (!config.ok) {
    console.log(JSON.stringify({ ready: false, profile, missingOrInvalid: config.missing }))
    process.exitCode = 1
  } else if (commands[command]) {
    if (command === 'upload') {
      if (!/^\d+$/.test(args[0] || '')) throw new Error('Use automation upload CONCEPT_ID JOB_FOLDER.')
      const pilot = JSON.parse(await readFile(path.join(backendRoot, 'config/pilot.json'), 'utf8'))
      const crm = new NocoBaseClient({ url: env.NOCOBASE_URL, token: env.NOCOBASE_API_KEY })
      const [job] = await crm.list('six_concepts', { id: args[0] })
      const [lead] = job ? await crm.list('six_leads', { id: job.leadId }) : []
      assertAuthorable(job, lead, pilot)
    }
    // Fixed executables/arguments; no shell interpolation or nested Codex process.
    const [script, ...fixed] = commands[command]
    const child = spawn(process.execPath, [path.join(backendRoot, 'scripts', script), ...fixed, ...args], { cwd: backendRoot, env, stdio: 'inherit' })
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) })
    process.exitCode = code ?? 1
  } else {
    const pilot = JSON.parse(await readFile(path.join(backendRoot, 'config/pilot.json'), 'utf8'))
    const crm = new NocoBaseClient({ url: env.NOCOBASE_URL, token: env.NOCOBASE_API_KEY })
    if (command === 'check') {
      const skills = env.CODEX_SKILLS_DIR || path.join(os.homedir(), '.codex/skills')
      const asa = env.ASA_DIR || path.join(os.homedir(), 'Desktop/Jays-Lab/ASA-UI-UX')
      for (const file of ['asa-page/SKILL.md', 'vectorcraft-logo/SKILL.md', 'vectorcraft-logo/scripts/vectorcraft.sh', 'copywriting/SKILL.md', 'copy-editing/SKILL.md']) await access(path.join(skills, file))
      await access(path.join(asa, 'node_modules/tsx/dist/loader.mjs'))
      store = createObjectStore(env) // Validate local S3 configuration without a write.
      if (args.includes('--online')) {
        for (const resource of ['six_leads', 'six_concepts', 'six_sources', 'six_runs', 'six_brand_assets']) await crm.list(resource, {}, { pageSize: 1, fields: ['id'] })
      }
      console.log(JSON.stringify({ ready: true, profile, crmReadAccessChecked: args.includes('--online'), storageConfigurationValid: true, storageRoundTripChecked: false }))
    } else if (command === 'status') {
      const leads = await crm.list('six_leads', {}, { paginate: false })
      const concepts = await crm.list('six_concepts', {}, { paginate: false })
      console.log(JSON.stringify(automationStatus(leads, concepts, pilot), null, 2))
    } else {
      if (args.length !== 1 || !/^\d+$/.test(args[0])) throw new Error('Use automation prepare CONCEPT_ID.')
      await withWorkerLock(async () => {
        const [job] = await crm.list('six_concepts', { id: args[0] })
        const [lead] = job ? await crm.list('six_leads', { id: job.leadId }) : []
        assertAuthorable(job, lead, pilot)
        store = createObjectStore(env)
        const prepared = await prepareConcept(job, lead, { backendRoot, env, store })
        console.log(JSON.stringify({ conceptId: job.id, leadId: lead.id, folder: prepared.folder, authored: prepared.source, previewUrl: job.previewUrl }))
      })
    }
  }
} catch {
  console.error('Automation setup or command failed. Check the live environment file, CRM API permissions, installed design tools and concept eligibility. No credentials or remote diagnostics are printed.')
  process.exitCode = 1
} finally { store?.close() }
