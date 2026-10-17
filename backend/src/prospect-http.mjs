import { createReadStream } from 'node:fs'
import path from 'node:path'
import { prospectGallery, prospectFile, shareTokenPattern } from './design-sharing.mjs'

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm' }

export function prospectHandler({ crm, backendRoot }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return json(405, { error: 'Method not allowed' }) }
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname
      const match = /^\/prospect-api\/designs\/([^/]+)(?:\/concepts\/([123])\/(.+))?$/.exec(pathname)
      if (!match || !shareTokenPattern.test(match[1])) return json(404, { error: 'Design link unavailable' })
      const [lead] = await crm.list('six_leads', { designShareToken: match[1], designSharingEnabled: true })
      if (!lead) return json(404, { error: 'Design link unavailable' })
      const jobs = await crm.list('six_concepts', { leadId: lead.id, briefVersion: lead.briefVersion || 1 }, { paginate: false })
      if (!match[2]) return json(200, prospectGallery(lead, jobs))
      const filename = decodeURIComponent(match[3])
      const file = await prospectFile(backendRoot, lead, jobs, Number(match[2]), filename)
      if (!file) return json(404, { error: 'Design link unavailable' })
      const html = path.extname(file) === '.html'
      // A generated concept is untrusted content, even after visual review. Its scripts never inherit CRM access.
      res.setHeader('Content-Security-Policy', html
        ? "sandbox allow-scripts; default-src 'none'; img-src 'self' data:; media-src 'self'; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'"
        : "default-src 'none'; sandbox")
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
      if (req.method === 'HEAD') return res.end()
      const stream = createReadStream(file)
      stream.on('error', () => res.destroy())
      stream.pipe(res)
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code) || /Publication file|URI malformed/.test(error.message)) return json(404, { error: 'Design link unavailable' })
      return json(503, { error: 'Design service temporarily unavailable' })
    }
  }
}
