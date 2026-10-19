import test from 'node:test'
import assert from 'node:assert/strict'
import { startupDiagnostic } from '../src/startup-diagnostics.mjs'
import { createObjectStore } from '../services/object-storage/index.mjs'

test('disabled CRM plugin names the required Railway preparation step', () => {
  const result = startupDiagnostic({ code: 'CRM_PLUGIN_DISABLED' }, 'CRM plugin check')
  assert.equal(result.code, 'CRM_PLUGIN_DISABLED')
  assert.equal(result.stage, 'CRM plugin check')
  assert.match(result.hint, /Pre-Deploy Command/)
  assert.match(result.hint, /npm run deploy:prepare/)
})

test('nested PostgreSQL failures identify the configuration problem without exposing SQL or credentials', () => {
  const secret = 'private-database-password-in-error'
  const result = startupDiagnostic({
    message: secret, sql: secret,
    original: { code: '3D000', message: secret, connection: { password: secret } },
  }, 'NocoBase startup')
  assert.equal(result.code, '3D000')
  assert.match(result.hint, /DB_DATABASE/)
  assert.ok(!JSON.stringify(result).includes(secret))
})

test('real object-store validation failures expose only safe configuration guidance', () => {
  const base = { DESIGN_S3_BUCKET: 'test-bucket', DESIGN_S3_REGION: 'auto' }
  for (const [env, expected] of [
    [{ DESIGN_S3_BUCKET: 'test-bucket' }, 'STORAGE_NOT_CONFIGURED'],
    [{ ...base, DESIGN_S3_ENDPOINT: 'bad endpoint private-token' }, 'ERR_INVALID_URL'],
    [{ ...base, DESIGN_S3_ENDPOINT: 'https://private-user:private-password@example.com' }, 'STORAGE_INVALID_ENDPOINT'],
    [{ ...base, DESIGN_S3_FORCE_PATH_STYLE: 'False' }, 'STORAGE_INVALID_PATH_STYLE'],
    [{ ...base, DESIGN_S3_ACCESS_KEY_ID: 'private-token' }, 'STORAGE_INCOMPLETE_CREDENTIALS'],
    [{ ...base, DESIGN_S3_BUCKET: 'Invalid Bucket private-token' }, 'STORAGE_INVALID_LOCATION'],
  ]) {
    let error
    try { createObjectStore(env, { client: {} }) } catch (caught) { error = caught }
    assert.ok(error)
    const result = startupDiagnostic(error, 'object storage configuration')
    assert.equal(result.code, expected)
    assert.ok(!JSON.stringify(result).includes('private-'))
  }
})

test('unknown errors and cyclic causes never leak arbitrary messages, names or configuration values', () => {
  const error = { message: 'password-secret', code: 'access-key-secret', name: 'user-secret', stack: 'token-secret' }
  error.cause = error
  const result = startupDiagnostic(error, 'untrusted-stage-secret')
  assert.equal(result.code, 'STARTUP_FAILED')
  assert.equal(result.stage, 'unknown startup step')
  assert.ok(!JSON.stringify(result).includes('secret'))
})
