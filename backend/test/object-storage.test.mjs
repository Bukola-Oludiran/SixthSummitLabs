import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createObjectStore } from '../services/object-storage/index.mjs'

const env = { DESIGN_S3_BUCKET: 'test-bucket', DESIGN_S3_REGION: 'us-east-1', DESIGN_S3_ACCESS_KEY_ID: 'test-access', DESIGN_S3_SECRET_ACCESS_KEY: 'test-secret' }

test('storage requires explicit bucket settings and rejects unsafe endpoints and keys', () => {
  assert.throws(() => createObjectStore({}), { code: 'STORAGE_NOT_CONFIGURED' })
  assert.throws(() => createObjectStore({ ...env, DESIGN_S3_ENDPOINT: 'http://remote.example' }), /HTTPS/)
  assert.throws(() => createObjectStore({ ...env, DESIGN_S3_ENDPOINT: 'https://user:secret@example.com' }), /HTTPS/)
  assert.throws(() => createObjectStore({ ...env, DESIGN_S3_SECRET_ACCESS_KEY: '' }), /both/)
  const store = createObjectStore(env, { client: {} })
  assert.equal(store.key(store.uri('drafts/a file.svg')), 'drafts/a file.svg')
  for (const key of ['/absolute', 'a/../b', 'a//b', 'a\\b']) assert.throws(() => store.uri(key), /key/)
  assert.throws(() => store.key('s3://other-bucket/sixsummit/draft'), /another bucket/)
  assert.throws(() => store.key('s3://test-bucket/other-prefix/draft'), /another bucket/)
})

test('SDK upload requires matching remote size and checksum before reporting success', async () => {
  let put
  const store = createObjectStore(env, { client: { async send(command) {
    if (command.constructor.name === 'PutObjectCommand') { put = command.input; return {} }
    return { ContentLength: 0, Metadata: { sha256: put.Metadata.sha256 } }
  } } })
  await assert.rejects(() => store.put('drafts/test', Buffer.from('complete bytes')), /verification/)
  assert.equal(put.ACL, undefined)
  assert.equal(put.CacheControl, 'private, no-store')
})

// A local wire fixture exercises real SDK signing/serialization and streaming,
// without claiming to validate credentials against a cloud provider.
test('S3 wire round trip signs private PUT, HEAD and GET requests', async () => {
  const objects = new Map()
  const requests = []
  const server = createServer(async (req, res) => {
    try {
      assert.match(req.headers.authorization || '', /^AWS4-HMAC-SHA256 /)
      requests.push(req.method)
      const key = new URL(req.url, 'http://localhost').pathname
      if (req.method === 'PUT') {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        assert.equal(req.headers['x-amz-acl'], undefined)
        objects.set(key, { bytes: Buffer.concat(chunks), sha256: req.headers['x-amz-meta-sha256'] })
        res.writeHead(200); res.end(); return
      }
      const object = objects.get(key)
      if (!object) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Length': object.bytes.length, 'x-amz-meta-sha256': object.sha256 })
      res.end(req.method === 'HEAD' ? undefined : object.bytes)
    } catch { res.writeHead(500); res.end() }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const store = createObjectStore({ ...env, DESIGN_S3_ENDPOINT: `http://127.0.0.1:${server.address().port}`, DESIGN_S3_FORCE_PATH_STYLE: 'true' })
  try {
    const bytes = Buffer.from('Editable design and logo bytes')
    await store.put('drafts/file.vectorcraft', bytes)
    assert.deepEqual(await store.get('drafts/file.vectorcraft'), bytes)
    let result = ''
    for await (const chunk of await store.open('drafts/file.vectorcraft')) result += chunk
    assert.equal(result, bytes.toString())
    assert.deepEqual(requests, ['PUT', 'HEAD', 'GET', 'GET'])
    assert.ok(objects.has('/test-bucket/sixsummit/drafts/file.vectorcraft'))
  } finally { store.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
