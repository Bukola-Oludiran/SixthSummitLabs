import { createRequire } from 'node:module'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { backendRoot } from './environment.mjs'

// Run in the build image, without credentials or a database connection. Missing
// nested dependencies and incomplete NocoBase builds must fail before deploy.
await import('../src/backend-runtime.mjs')
const root = path.join(backendRoot, 'nocobase')
const require = createRequire(path.join(root, 'package.json'))
require('@nocobase/cli-v1')
require('@nocobase/server')
require('@nocobase/plugin-sixsummit-crm')
require(path.join(root, 'packages/core/app/lib/config'))
for (const file of [
  'packages/core/app/dist/client/index.html',
  'packages/plugins/@nocobase/plugin-sixsummit-crm/dist/client/index.js',
]) await access(path.join(root, file))
console.log('Production dependencies, NocoBase and CRM assets are ready.')
