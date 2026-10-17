import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, delimiter, join } from 'node:path'
import { backendRoot, environment } from './environment.mjs'

const env = await environment()
if (['dev', 'build', 'plugin:enable', 'plugin:build'].includes(process.argv[2])) await import('./link-plugin.mjs')
const node22 = env.NOCOBASE_NODE_BINARY ||
  (existsSync('/opt/homebrew/opt/node@22/bin/node') ? '/opt/homebrew/opt/node@22/bin/node' : process.execPath)
const yarn = spawnSync('which', ['yarn'], { encoding: 'utf8' }).stdout.trim()
if (!yarn) throw new Error('Install Yarn Classic 1.22.x before starting NocoBase.')
const commands = {
  dependencies: ['install', '--frozen-lockfile'],
  install: ['nocobase', 'install', '--lang=en-US'],
  dev: ['dev'],
  build: ['build'],
  'plugin:enable': ['pm', 'enable', '@nocobase/plugin-sixsummit-crm'],
  'plugin:build': ['build', '@nocobase/plugin-sixsummit-crm', '--no-dts'],
  'plugin:test': ['test', 'packages/plugins/@nocobase/plugin-sixsummit-crm/src/server/__tests__/domain.test.ts', '--run', '--reporter=verbose'],
}
const args = commands[process.argv[2]]
if (!args) throw new Error('Expected dependencies, install, dev, or build.')
env.PATH = [dirname(node22), env.PATH].join(delimiter)
const child = spawn(node22, [yarn, ...args], {
  cwd: join(backendRoot, 'nocobase'), env, stdio: 'inherit',
})
child.on('error', (error) => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
