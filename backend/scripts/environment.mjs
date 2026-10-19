import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

export const backendRoot = fileURLToPath(new URL('../', import.meta.url))

export async function environment({ file = process.env.SIXSUMMIT_ENV_FILE, inherit = process.env } = {}) {
  let local = {}
  try {
    local = parseEnv(await readFile(file || new URL('../.env', import.meta.url), 'utf8'))
  } catch (error) {
    if (file || error.code !== 'ENOENT') throw error
  }
  // Load the selected backend profile only; never the marketing site's .env.
  return { ...local, ...inherit }
}
