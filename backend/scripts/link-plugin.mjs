import { access, cp, lstat, mkdir, readFile, readlink, symlink, unlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { backendRoot } from './environment.mjs'

const source = path.join(backendRoot, 'packages/plugins/@nocobase/plugin-sixsummit-crm')
const upstream = path.join(backendRoot, 'nocobase')
await access(path.join(source, 'package.json'))
const runtime = path.join(upstream, 'packages/plugins/@nocobase/plugin-sixsummit-crm')
let runtimeInfo
try { runtimeInfo = await lstat(runtime) } catch (error) { if (error.code !== 'ENOENT') throw error }
if (runtimeInfo) {
  const info = runtimeInfo
  if (info.isSymbolicLink()) {
    if (path.resolve(path.dirname(runtime), await readlink(runtime)) !== source) throw new Error('Unexpected CRM plugin link.')
    await unlink(runtime)
  } else {
    try { await access(path.join(runtime, '.sixsummit-managed')) }
    catch { throw new Error('An unmanaged CRM plugin already exists; refusing to overwrite it.') }
  }
}
await mkdir(runtime, { recursive: true })
await cp(source, runtime, { recursive: true })
await writeFile(path.join(runtime, '.sixsummit-managed'), 'Source: backend/packages/plugins/@nocobase/plugin-sixsummit-crm\n')
for (const [link, target] of [
  [path.join(upstream, 'node_modules/@nocobase/plugin-sixsummit-crm'), runtime],
  [path.join(backendRoot, 'node_modules'), path.join(upstream, 'node_modules')],
]) {
  await mkdir(path.dirname(link), { recursive: true })
  try {
    const info = await lstat(link)
    if (!info.isSymbolicLink()) throw new Error(`Expected a plugin symlink at ${link}; refusing to replace a directory.`)
    if (path.resolve(path.dirname(link), await readlink(link)) !== target) {
      await unlink(link)
      await symlink(path.relative(path.dirname(link), target), link, 'dir')
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await symlink(path.relative(path.dirname(link), target), link, 'dir')
  }
}
const result = spawnSync('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: upstream, encoding: 'utf8' })
if (result.status !== 0) throw new Error('Could not find the submodule local exclusion file.')
const exclude = path.resolve(upstream, result.stdout.trim())
await mkdir(path.dirname(exclude), { recursive: true })
let text = ''
try { text = await readFile(exclude, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
const rule = '/packages/plugins/@nocobase/plugin-sixsummit-crm'
if (!text.split('\n').includes(rule)) await writeFile(exclude, `${text}\n${rule}\n`)
console.log('Project CRM plugin is linked into the pinned NocoBase checkout.')
