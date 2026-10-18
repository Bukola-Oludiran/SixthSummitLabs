import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'

export const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex')
export const validKey = (key) => typeof key === 'string' && key.length > 0 && key.length <= 900 && !/[\\\u0000-\u001f]/.test(key) && key.split('/').every(part => part && part !== '.' && part !== '..')

export function createObjectStore(env, { client } = {}) {
  if (!env.DESIGN_S3_BUCKET || !env.DESIGN_S3_REGION) throw Object.assign(new Error('Configure DESIGN_S3_BUCKET and DESIGN_S3_REGION before uploading or publishing designs.'), { code: 'STORAGE_NOT_CONFIGURED' })
  const bucket = env.DESIGN_S3_BUCKET
  const prefix = env.DESIGN_S3_PREFIX || 'sixsummit'
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || !validKey(prefix)) throw new Error('Invalid design bucket or prefix.')
  let endpoint
  if (env.DESIGN_S3_ENDPOINT) {
    endpoint = new URL(env.DESIGN_S3_ENDPOINT)
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)))) throw new Error('Use an HTTPS S3 endpoint, or HTTP on loopback for local testing.')
    endpoint = endpoint.href
  }
  if (env.DESIGN_S3_FORCE_PATH_STYLE && !['true', 'false'].includes(env.DESIGN_S3_FORCE_PATH_STYLE)) throw new Error('DESIGN_S3_FORCE_PATH_STYLE must be true or false.')
  const accessKeyId = env.DESIGN_S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID
  const secretAccessKey = env.DESIGN_S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) throw new Error('Supply both S3 credential fields, or use the AWS default credential chain.')
  const sdk = client || new S3Client({
    region: env.DESIGN_S3_REGION, endpoint,
    forcePathStyle: env.DESIGN_S3_FORCE_PATH_STYLE === 'true',
    credentials: accessKeyId ? { accessKeyId, secretAccessKey, sessionToken: env.DESIGN_S3_SESSION_TOKEN || env.AWS_SESSION_TOKEN || undefined } : undefined,
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 3,
  })
  const objectKey = (key) => {
    if (!validKey(key)) throw new Error('Invalid storage key.')
    return `${prefix}/${key}`
  }
  const get = async (key) => {
    const response = await sdk.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(key) }), { abortSignal: AbortSignal.timeout(120000) })
    return response.Body
  }
  return {
    uri(key) { return `s3://${bucket}/${objectKey(key).split('/').map(encodeURIComponent).join('/')}` },
    key(uri) {
      const location = new URL(uri)
      const key = decodeURIComponent(location.pathname.slice(1))
      if (location.protocol !== 's3:' || location.hostname !== bucket || location.username || location.password || location.port || location.search || location.hash || !key.startsWith(`${prefix}/`)) throw new Error('Storage reference belongs to another bucket or prefix.')
      const relative = key.slice(prefix.length + 1)
      objectKey(relative)
      return relative
    },
    async put(key, body, contentType = 'application/octet-stream') {
      const sha256 = checksum(body)
      const input = { Bucket: bucket, Key: objectKey(key), Body: body, ContentLength: body.length, ContentType: contentType, CacheControl: 'private, no-store', Metadata: { sha256 } }
      // No public ACL: both draft and published objects remain in the private bucket.
      await sdk.send(new PutObjectCommand(input), { abortSignal: AbortSignal.timeout(120000) })
      const verified = await sdk.send(new HeadObjectCommand({ Bucket: bucket, Key: input.Key }), { abortSignal: AbortSignal.timeout(30000) })
      if (verified.ContentLength !== body.length || verified.Metadata?.sha256 !== sha256) throw new Error('Storage upload verification failed.')
    },
    async get(key) { return Buffer.from(await (await get(key)).transformToByteArray()) },
    async open(key) { return get(key) },
    close() { sdk.destroy?.() },
  }
}
