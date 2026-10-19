import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { once } from 'node:events'
import path from 'node:path'
import { backendRoot, environment } from './environment.mjs'
import { withWorkerLock } from './context.mjs'
import { createBackendRuntime } from '../src/backend-runtime.mjs'
import { startupDiagnostic } from '../src/startup-diagnostics.mjs'

// Direct Node entry point: no PM2, child server, watcher, proxy or CLI wrapper.
const env = await environment()
const source = process.argv.includes('--source')
const initialize = process.argv.includes('--initialize')
if (source && env.APP_ENV === 'production') throw new Error('Production requires npm run crm:build; source mode is for development.')
if (initialize && source) throw new Error('Deployment preparation requires compiled production code.')
if (initialize && ['APP_KEY', 'INIT_ROOT_EMAIL', 'INIT_ROOT_PASSWORD'].some((key) => !env[key]?.trim())) {
  throw new Error('Deployment preparation requires APP_KEY, INIT_ROOT_EMAIL and INIT_ROOT_PASSWORD.')
}
const port = Number(env.PORT || env.APP_PORT || 13000)
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.')
const root = path.join(backendRoot, 'nocobase')
const appRoot = path.join(root, 'packages/core/app')
if (!source && !existsSync(path.join(appRoot, 'lib/config/index.js'))) {
  throw new Error('Build NocoBase first with npm run crm:build, or use npm run dev for the source server.')
}
Object.assign(process.env, env, {
  APP_ENV: source ? 'development' : 'production',
  NODE_ENV: source ? 'development' : 'production',
  APP_PORT: String(port),
  APP_PUBLIC_PATH: env.APP_PUBLIC_PATH || '/crm/',
  APP_PACKAGE_ROOT: appRoot,
  APP_DISCOVERY_ADAPTER: 'main-only',
  APP_PROCESS_ADAPTER: 'main-only',
  APP_COMMAND_ADAPTER: '',
  NOCOBASE_URL: `http://127.0.0.1:${port}${(env.APP_PUBLIC_PATH || '/crm/').replace(/\/$/, '')}`,
})
process.chdir(root)
const require = createRequire(path.join(root, 'package.json'))
const cli = require('@nocobase/cli-v1')
cli.initEnv()
// The normal CLI renders this template before spawning its server. Our direct
// entry point must also apply the runtime /crm/ asset, API and WebSocket paths.
if (!source) cli.buildIndexHtml()
if (source) {
  require('tsx/cjs/api').register({ tsconfig: path.join(root, 'tsconfig.server.json') })
  require('tsconfig-paths/register')
}
const { Gateway, AppSupervisor, runPluginStaticImports } = require('@nocobase/server')
const { lockdownSes } = require('@nocobase/utils')
const { getConfig } = require(path.join(appRoot, source ? 'src/config' : 'lib/config'))
await runPluginStaticImports()
const gateway = Gateway.getInstance()
const supervisor = AppSupervisor.getInstance()
const app = supervisor.bootMainApp(await getConfig())
app.setMaxListeners(50) // Match NocoBase's standard gateway startup.
let runtime
const makeRuntime = () => createBackendRuntime({ app, env: process.env, withLock: withWorkerLock })
const requestHandler = (req, res) => runtime.handle(req, res)
app.once('afterStart', () => lockdownSes({
  consoleTaming: 'unsafe', errorTaming: 'unsafe', overrideTaming: 'moderate', stackFiltering: 'verbose',
}))
app.on('beforeStop', () => runtime?.stop())
app.on('afterStart', () => {
  if (runtime) { runtime = makeRuntime(); runtime.start() }
})
app.on('afterDestroy', () => Gateway.unregisterRequestHandler(requestHandler))
const close = async () => {
  await runtime?.stop()
  await app.destroy().catch(() => {})
  await supervisor.destroy().catch(() => {})
  gateway.destroy()
}
let stage = 'database preparation'
try {
  // An explicit pre-deploy command prepares a new database without reset/force.
  // Ordinary service startup never installs or changes the CRM schema.
  if (initialize && !(await app.isInstalled())) {
    await app.runAsCLI(['install', '--lang=en-US'], { from: 'user', throwError: true })
  }
  // Use the normal start command in-process, including install checks and events.
  stage = 'NocoBase startup'
  await app.runAsCLI(['start'], { from: 'user', throwError: true })
  if (initialize && !app.pm.get('@nocobase/plugin-sixsummit-crm')?.enabled) {
    stage = 'CRM plugin enablement'
    await app.pm.enable('@nocobase/plugin-sixsummit-crm')
  }
  stage = 'CRM plugin check'
  if (!app.pm.get('@nocobase/plugin-sixsummit-crm')?.enabled) {
    throw Object.assign(new Error('CRM plugin is disabled.'), { code: 'CRM_PLUGIN_DISABLED' })
  }
  stage = 'object storage configuration'
  runtime = makeRuntime()
  Gateway.registerRequestHandler(requestHandler)
  stage = 'HTTP listener'
  gateway.startHttpServer({ port, host: initialize ? '127.0.0.1' : env.APP_HOST || '0.0.0.0' })
  await once(gateway.server, 'listening')
  if (initialize) {
    // Bootstrap talks only to this process's temporary loopback listener.
    stage = 'CRM bootstrap'
    await import('./bootstrap-crm.mjs')
    stage = 'preparation shutdown'
    await close()
    console.log('Deployment preparation complete; the backend can now start.')
  } else {
    stage = 'publication startup'
    runtime.start()
    console.log(`6ixSummit backend ready: one Node process (PID ${process.pid}), port ${port}.`)
  }
} catch (error) {
  console.error('Backend startup failed:', JSON.stringify(startupDiagnostic(error, stage)))
  await close()
  process.exitCode = 1
}
