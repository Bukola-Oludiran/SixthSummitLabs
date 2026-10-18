import path from 'node:path'
import { prospectGallery, prospectFile, shareTokenPattern } from './design-sharing.mjs'
import { artifactBytes, conceptIdentity, readManifest } from './design-artifacts.mjs'

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm' }

export function prospectHandler({ crm, store, staffDetail }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return json(405, { error: 'Method not allowed' }) }
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname
      const staff = /^\/prospect-api\/staff\/leads\/([1-9]\d*)\/concepts\/([1-9]\d*)\/(desktop|mobile)\.png$/.exec(pathname)
      if (staff) {
        const authorization = req.headers.authorization
        if (!staffDetail || typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) return json(401, { error: 'Staff sign-in required' })
        // Authorize through the caller's own CRM token and row permissions, never the service's root session.
        const record = await staffDetail(authorization.slice(7), req.headers['x-role'], Number(staff[1]))
        const job = record.concepts.find(concept => concept.id === Number(staff[2]))
        if (!job?.artifactManifest) return json(404, { error: 'Private preview unavailable' })
        if (!store) return json(503, { error: 'Design storage is not configured' })
        const { manifest, prefix } = await readManifest(store, job.artifactManifest, conceptIdentity(job, record.lead))
        const name = staff[3] === 'desktop' ? 'review/wide.png' : 'review/narrow.png'
        const file = manifest.files.find(entry => entry.path === name)
        if (!file) return json(404, { error: 'Private preview unavailable' })
        const bytes = await artifactBytes(store, prefix, file)
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': bytes.length })
        return res.end(req.method === 'HEAD' ? undefined : bytes)
      }
      const match = /^\/prospect-api\/designs\/([^/]+)(?:\/concepts\/([123])\/(.+))?$/.exec(pathname)
      if (!match || !shareTokenPattern.test(match[1])) return json(404, { error: 'Design link unavailable' })
      const [lead] = await crm.list('six_leads', { designShareToken: match[1], designSharingEnabled: true })
      if (!lead) return json(404, { error: 'Design link unavailable' })
      const jobs = await crm.list('six_concepts', { leadId: lead.id, briefVersion: lead.briefVersion || 1 }, { paginate: false })
      if (!match[2]) return json(200, prospectGallery(lead, jobs))
      const filename = decodeURIComponent(match[3])
      const file = await prospectFile(store, lead, jobs, Number(match[2]), filename)
      if (!file) return json(404, { error: 'Design link unavailable' })
      const html = path.extname(filename) === '.html'
      // A generated concept is untrusted content, even after visual review. Its scripts never inherit CRM access.
      res.setHeader('Content-Security-Policy', html
        ? "sandbox allow-scripts; default-src 'none'; img-src 'self' data:; media-src 'self'; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'"
        : "default-src 'none'; sandbox")
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': file.size })
      if (req.method === 'HEAD') { file.body.destroy(); return res.end() }
      const stream = file.body
      stream.on('error', () => res.destroy())
      stream.pipe(res)
    } catch (error) {
      if ([401, 403, 404].includes(error.status)) return json(error.status, { error: 'Private preview unavailable' })
      if (['NoSuchKey', 'NotFound'].includes(error.name) || /URI malformed/.test(error.message)) return json(404, { error: 'Design link unavailable' })
      return json(503, { error: 'Design service temporarily unavailable' })
    }
  }
}
