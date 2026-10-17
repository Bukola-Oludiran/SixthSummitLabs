import { randomBytes } from 'node:crypto'
import { readFile, writeFile, symlink, lstat } from 'node:fs/promises'

const destination = new URL('../.env', import.meta.url)
const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8')
const values = template
  .replace(/^APP_KEY=$/m, `APP_KEY=${randomBytes(32).toString('hex')}`)
  .replace(/^DB_PASSWORD=$/m, `DB_PASSWORD=${randomBytes(24).toString('base64url')}`)
  .replace(/^INIT_ROOT_PASSWORD=$/m, `INIT_ROOT_PASSWORD=${randomBytes(24).toString('base64url')}`)
try {
  await writeFile(destination, values, { flag: 'wx', mode: 0o600 })
  console.log('Created backend/.env with generated local credentials.')
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  console.log('Kept the existing backend/.env.')
}
const applicationEnv = new URL('../nocobase/.env', import.meta.url)
try {
  await lstat(applicationEnv)
  console.log('Kept the existing NocoBase environment file.')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  await symlink('../.env', applicationEnv)
  console.log('Linked NocoBase to the backend environment file.')
}
