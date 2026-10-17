import { createRequire } from 'node:module'
import path from 'node:path'
import { backendRoot } from './environment.mjs'

const root = path.join(backendRoot, 'nocobase')
const require = createRequire(path.join(root, 'package.json'))
const ts = require('typescript')
const file = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
if (file.error) throw new Error('NocoBase TypeScript configuration could not be read.')
const config = ts.parseJsonConfigFileContent(file.config, ts.sys, root)
const plugin = path.join(root, 'packages/plugins/@nocobase/plugin-sixsummit-crm/src')
const files = ts.sys.readDirectory(plugin, ['.ts', '.tsx'])
const program = ts.createProgram(files, { ...config.options, noEmit: true, incremental: false })
const diagnostics = ts.getPreEmitDiagnostics(program)
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: (file) => file, getNewLine: () => '\n' }))
  process.exitCode = 1
} else console.log('CRM plugin types pass against the pinned NocoBase source.')
