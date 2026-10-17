import { readFile, mkdir, open, unlink } from 'node:fs/promises'
import path from 'node:path'
import { environment, backendRoot } from './environment.mjs'
import { NocoBaseClient } from '../src/crm.mjs'

export async function context() {
  const env = await environment()
  const pilot = JSON.parse(await readFile(path.join(backendRoot, 'config/pilot.json'), 'utf8'))
  const crm = new NocoBaseClient({ url: env.NOCOBASE_URL || 'http://127.0.0.1:13000/crm', token: env.NOCOBASE_API_KEY })
  if (!crm.token) await crm.signIn(env.INIT_ROOT_EMAIL, env.INIT_ROOT_PASSWORD)
  return { env, pilot, crm }
}

export async function withWorkerLock(work) {
  const folder = path.join(backendRoot, 'storage')
  await mkdir(folder, { recursive: true, mode: 0o700 })
  const lockPath = path.join(folder, 'worker.lock')
  let file
  try { file = await open(lockPath, 'wx', 0o600) } catch { throw new Error('A worker is already running. If it crashed, check its process before removing backend/storage/worker.lock.') }
  await file.writeFile(String(process.pid))
  try { return await work() } finally { await file.close(); await unlink(lockPath) }
}
