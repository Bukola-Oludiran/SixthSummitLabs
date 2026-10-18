import { Readable } from 'node:stream'

export function memoryStore() {
  const objects = new Map()
  return {
    objects,
    uri(key) { return `s3://test-bucket/sixsummit/${key}` },
    key(uri) {
      if (!uri?.startsWith('s3://test-bucket/sixsummit/')) throw new Error('Invalid storage reference')
      return uri.slice('s3://test-bucket/sixsummit/'.length)
    },
    async put(key, bytes) { objects.set(key, Buffer.from(bytes)) },
    async get(key) { if (!objects.has(key)) throw Object.assign(new Error('Missing'), { name: 'NoSuchKey' }); return objects.get(key) },
    async open(key) { return Readable.from([await this.get(key)]) },
  }
}
