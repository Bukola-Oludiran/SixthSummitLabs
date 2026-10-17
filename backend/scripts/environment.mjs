import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

export const backendRoot = fileURLToPath(new URL('../', import.meta.url))

export async function environment() {
  let local = {}
  try {
    local = parseEnv(await readFile(new URL('../.env', import.meta.url), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  // Only this backend's .env is loaded. The marketing site's GIT_TOKEN is not used.
  return { ...local, ...process.env }
}
