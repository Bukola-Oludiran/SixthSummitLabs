import path from 'node:path'
import { prospectGallery, prospectFile, shareTokenPattern } from './design-sharing.mjs'
import { artifactBytes, conceptIdentity, readManifest, publishableExtensions } from './design-artifacts.mjs'
import { draftPreviews } from './draft-previews.mjs'
import { previewFrameScript, previewFrameTag } from './preview-frame.mjs'

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm' }

const htmlPolicy = "sandbox allow-scripts; default-src 'none'; img-src 'self' data:; media-src 'self'; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'"
const designHeaders = (res, filename) => {
  res.setHeader('Content-Security-Policy', path.extname(filename).toLowerCase() === '.html' ? htmlPolicy : "default-src 'none'; sandbox")
  // Sandboxed scripts/fonts have an opaque origin. This allows only the scoped
  // file response; neither the issue endpoint nor CRM APIs expose CORS access.
  res.setHeader('Access-Control-Allow-Origin', '*')
}

export function prospectHandler({ crm, store, staffDetail, previewOptions = {} }) {
  const previews = staffDetail ? draftPreviews({ ...previewOptions, staffDetail }) : undefined
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname
      const issue = /^\/prospect-api\/staff\/leads\/([1-9]\d*)\/concepts\/([1-9]\d*)\/preview$/.exec(pathname)
      if (issue) {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(405, { error: 'Method not allowed' }) }
        const authorization = req.headers.authorization
        if (!previews || typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) return json(401, { error: 'Staff sign-in required' })
        if (!store) return json(503, { error: 'Design storage is not configured' })
        const preview = await previews.issue(authorization.slice(7), req.headers['x-role'], Number(issue[1]), Number(issue[2]))
        return preview ? json(200, preview) : json(404, { error: 'Private preview unavailable' })
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return json(405, { error: 'Method not allowed' }) }
      if (pathname === '/prospect-api/preview-frame.js') {
        const script = Buffer.from(previewFrameScript)
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
        res.writeHead(200, { 'Content-Type': 'text/javascript', 'Content-Length': script.length })
        return res.end(req.method === 'HEAD' ? undefined : script)
      }
      const draft = /^\/prospect-api\/previews\/([A-Za-z0-9_-]{43})\/files\/(.+)$/.exec(pathname)
      if (draft) {
        const record = await previews?.resolve(draft[1])
        if (!record) return json(404, { error: 'Private preview unavailable' })
        const filename = decodeURIComponent(draft[2])
        if (!publishableExtensions.has(path.extname(filename).toLowerCase()) || filename.split('/').some(part => !part || part.startsWith('.') || ['review', 'node_modules'].includes(part))) return json(404, { error: 'Private preview unavailable' })
        const { manifest, prefix } = await readManifest(store, record.job.artifactManifest, conceptIdentity(record.job, record.lead))
        const file = manifest.files.find(entry => entry.path === `authored/${filename}`)
        if (!file) return json(404, { error: 'Private preview unavailable' })
        const original = await artifactBytes(store, prefix, file)
        const bytes = path.extname(filename).toLowerCase() === '.html' ? Buffer.concat([original, previewFrameTag]) : original
        designHeaders(res, filename)
        res.writeHead(200, { 'Content-Type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream', 'Content-Length': bytes.length })
        return res.end(req.method === 'HEAD' ? undefined : bytes)
      }
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
      // A generated concept is untrusted content, even after visual review. Its scripts never inherit CRM access.
      designHeaders(res, filename)
      const html = path.extname(filename).toLowerCase() === '.html'
      res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': file.size + (html ? previewFrameTag.length : 0) })
      if (req.method === 'HEAD') { file.body.destroy(); return res.end() }
      if (html) {
        // Append viewer behaviour at delivery time; immutable R2 snapshots are unchanged.
        for await (const bytes of file.body) res.write(bytes)
        return res.end(previewFrameTag)
      }
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
