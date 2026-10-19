import { createObjectStore } from '../services/object-storage/index.mjs'
import { NocoBaseClient } from './crm.mjs'
import { publishReviewedDesigns } from './design-sharing.mjs'
import { prospectHandler } from './prospect-http.mjs'

const tables = new Set(['six_leads', 'six_concepts'])
const publicationFields = {
  six_leads: new Set(['designShareToken', 'designShareUrl', 'designSharingEnabled']),
  six_concepts: new Set(['previewUrl', 'publicationKey', 'publicationManifest', 'publishedAt']),
}

// Only trusted publication and token lookup code receives this adapter. Staff
// requests still pass through NocoBase authentication and the CRM's row rules.
export function publicationRepository(db) {
  const repository = (table) => {
    if (!tables.has(table)) throw new Error('Unsupported publication collection')
    return db.getRepository(table)
  }
  return {
    async list(table, filter = {}) {
      return (await repository(table).find({ filter })).map((row) => row.toJSON())
    },
    async update(table, id, values) {
      const repo = repository(table)
      if (Object.keys(values).some((key) => !publicationFields[table].has(key))) {
        throw new Error('Unsupported publication update')
      }
      return repo.update({ filterByTk: id, values })
    },
  }
}

export function createBackendRuntime({
  app, env, withLock, store = env.DESIGN_S3_BUCKET ? createObjectStore(env) : undefined,
  publish = publishReviewedDesigns, intervalMs = 30000, logger = console,
}) {
  const crm = publicationRepository(app.db)
  let stopping = false
  let timer
  let active
  let closed
  const staffDetail = async (token, role, leadId) => {
    if (!['root', 'sixsummit_caller'].includes(role)) {
      throw Object.assign(new Error('Staff role required'), { status: 403 })
    }
    // This loopback call enters the same process's normal auth/ACL middleware.
    // Neither the caller's token nor a root credential is replaced or persisted.
    const staff = new NocoBaseClient({ url: env.NOCOBASE_URL, token, role })
    return (await staff.request('six_crm', 'detail', { query: { leadId } })).data
  }
  const prospect = prospectHandler({ crm, store, staffDetail })
  const sync = () => {
    if (stopping || active) return active || Promise.resolve()
    active = (async () => {
      try {
        const result = await withLock(() => publish(crm, { store, publicSiteUrl: env.PUBLIC_SITE_URL }))
        if (result.failed) logger.error('Some reviewed designs could not publish; check storage and uploaded bundles.')
      } catch {
        // No raw SDK, database or HTTP errors: these can contain secrets.
        logger.error('Design publication deferred; check the database, storage and worker lock.')
      }
    })().finally(() => { active = undefined })
    return active
  }
  return {
    async handle(req, res) {
      const pathname = new URL(req.url, 'http://localhost').pathname
      if (pathname === '/health') {
        let ready = false
        if (!stopping && await app.isStarted()) {
          try {
            await app.db.getRepository('six_leads').findOne({ fields: ['id'] })
            ready = true
          } catch { /* not ready until the CRM database can be queried */ }
        }
        const allowed = ['GET', 'HEAD'].includes(req.method)
        res.writeHead(allowed ? (ready ? 200 : 503) : 405, {
          'Content-Type': 'application/json', 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff', ...(!allowed ? { Allow: 'GET, HEAD' } : {}),
        })
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: allowed && ready }))
        return
      }
      if (pathname === '/prospect-api' || pathname.startsWith('/prospect-api/')) {
        if (stopping) {
          res.writeHead(503, { 'Cache-Control': 'no-store' }); res.end(); return
        }
        await prospect(req, res)
        return
      }
      return false // let the native gateway serve CRM APIs, admin assets and WS
    },
    start() {
      if (timer || stopping) return
      void sync()
      timer = setInterval(sync, intervalMs)
      timer.unref()
    },
    sync,
    async stop() {
      if (!closed) {
        stopping = true
        clearInterval(timer)
        closed = (async () => { await active; store?.close() })()
      }
      await closed
    },
  }
}
