const stages = new Set([
  'database preparation', 'NocoBase startup', 'CRM plugin enablement',
  'CRM plugin check', 'object storage configuration', 'HTTP listener',
  'CRM bootstrap', 'preparation shutdown', 'publication startup',
])

const codes = new Map([
  ['APP_NOT_INSTALLED_ERROR', 'Set the Railway Pre-Deploy Command to npm run deploy:prepare, then redeploy.'],
  ['CRM_PLUGIN_DISABLED', 'The CRM plugin is not enabled. Run npm run deploy:prepare as the Railway Pre-Deploy Command, then redeploy.'],
  ['STORAGE_NOT_CONFIGURED', 'Set DESIGN_S3_BUCKET and DESIGN_S3_REGION; use auto for R2.'],
  ['ERR_INVALID_URL', 'Check the configured URL format. DESIGN_S3_ENDPOINT must be the full HTTPS S3 API endpoint.'],
  ['28P01', 'Database authentication failed. Check DB_USER and DB_PASSWORD.'],
  ['28000', 'Database access was rejected. Check the database role and required TLS settings.'],
  ['3D000', 'Database does not exist. DB_DATABASE must contain only its name, without URL query parameters.'],
  ['42P01', 'A required database table is missing. Check the deployment preparation step.'],
  ['ECONNREFUSED', 'Connection refused. Check the database hostname, port and service availability.'],
  ['ENOTFOUND', 'Hostname lookup failed. Check DB_HOST and APP_HOST.'],
  ['ETIMEDOUT', 'Connection timed out. Check database availability and network access.'],
  ['EADDRINUSE', 'The listener port is already in use. Run only the bundled backend service.'],
  ['EACCES', 'Access was denied. Check runtime volume permissions and the listener configuration.'],
  ['SELF_SIGNED_CERT_IN_CHAIN', 'Database TLS verification failed. Check the endpoint and trusted CA configuration.'],
  ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'Database TLS verification failed. Check the endpoint and trusted CA configuration.'],
  ['CERT_HAS_EXPIRED', 'A TLS certificate has expired. Check the database endpoint and certificate configuration.'],
])

// Match only fixed local validation messages. Never print arbitrary messages,
// URLs, SQL, stacks or error objects: these can contain database/R2 credentials.
const messages = new Map([
  ['Invalid design bucket or prefix.', ['STORAGE_INVALID_LOCATION', 'Check DESIGN_S3_BUCKET (bucket name only) and DESIGN_S3_PREFIX (an object key prefix).']],
  ['Use an HTTPS S3 endpoint, or HTTP on loopback for local testing.', ['STORAGE_INVALID_ENDPOINT', 'DESIGN_S3_ENDPOINT must be the HTTPS S3 API endpoint, without embedded credentials or query parameters.']],
  ['DESIGN_S3_FORCE_PATH_STYLE must be true or false.', ['STORAGE_INVALID_PATH_STYLE', 'Set DESIGN_S3_FORCE_PATH_STYLE to lowercase true or false.']],
  ['Supply both S3 credential fields, or use the AWS default credential chain.', ['STORAGE_INCOMPLETE_CREDENTIALS', 'Set both DESIGN_S3_ACCESS_KEY_ID and DESIGN_S3_SECRET_ACCESS_KEY.']],
  ['NocoBase auth:signIn failed (401).', ['CRM_BOOTSTRAP_AUTH_FAILED', 'INIT_ROOT_EMAIL and INIT_ROOT_PASSWORD must authenticate against the existing administrator account.']],
])

export function startupDiagnostic(error, stage) {
  const step = stages.has(stage) ? stage : 'unknown startup step'
  const queue = [error]
  const seen = new Set()
  while (queue.length && seen.size < 12) {
    const entry = queue.shift()
    if (!entry || typeof entry !== 'object' || seen.has(entry)) continue
    seen.add(entry)
    if (codes.has(entry.code)) return { stage: step, code: entry.code, hint: codes.get(entry.code) }
    if (messages.has(entry.message)) {
      const [code, hint] = messages.get(entry.message)
      return { stage: step, code, hint }
    }
    queue.push(entry.cause, entry.original, entry.parent)
  }
  return { stage: step, code: 'STARTUP_FAILED', hint: 'Check the logs and configuration for this startup step. Raw error details were withheld to protect credentials.' }
}
