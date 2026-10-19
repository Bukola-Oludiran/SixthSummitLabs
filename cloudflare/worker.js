// Keep the React workspace on Cloudflare; only its server routes reach Railway.
export function backendRoute(pathname) {
  if (/^\/prospect-api(?:\/|$)/.test(pathname)) return true
  return /^\/crm\/.+/.test(pathname)
    && !/^\/crm\/(?:leads|follow-ups|analytics|designs|login)(?:\/|$)/.test(pathname)
}

function privateResponse(response) {
  // Returning the original 101 response preserves Cloudflare's WebSocket tunnel.
  if (response.status === 101) return response
  const result = new Response(response.body, response)
  result.headers.set('Cache-Control', 'no-store')
  result.headers.set('Cloudflare-CDN-Cache-Control', 'no-store')
  result.headers.set('CDN-Cache-Control', 'no-store')
  result.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  result.headers.set('Referrer-Policy', 'no-referrer')
  return result
}

function backendOrigin(value, publicUrl) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/'
    || url.search || url.hash || url.host === publicUrl.host) throw new Error('Invalid backend origin')
  return url.origin
}

export function createWorker(upstreamFetch = (...args) => fetch(...args)) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url)
      // NocoBase's legacy client still references these two root-relative files.
      if (['/global.css', '/browser-checker.js'].includes(url.pathname)) {
        return privateResponse(new Response(null, {
          status: 302, headers: { Location: `/crm${url.pathname}${url.search}` },
        }))
      }
      if (!backendRoute(url.pathname)) {
        const response = await env.ASSETS.fetch(request)
        return /^\/(?:crm|designs)(?:\/|$)/.test(url.pathname) ? privateResponse(response) : response
      }

      try {
        const origin = backendOrigin(env.BACKEND_ORIGIN, url)
        // Set the origin explicitly; never let a path or query choose the host.
        const target = new URL(request.url)
        target.protocol = 'https:'
        target.host = new URL(origin).host
        const forwarded = new Request(target, request)
        forwarded.headers.set('Host', target.host)
        forwarded.headers.set('X-Forwarded-Host', url.host)
        forwarded.headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1))
        forwarded.headers.delete('Forwarded')
        forwarded.headers.delete('X-Forwarded-Port')
        forwarded.headers.delete('X-Forwarded-For')
        const clientIp = request.headers.get('CF-Connecting-IP')
        if (clientIp) forwarded.headers.set('X-Forwarded-For', clientIp)
        const response = await upstreamFetch(forwarded, {
          redirect: 'manual', cache: 'no-store',
          cf: { cacheTtlByStatus: { '100-599': -1 } },
        })
        const result = privateResponse(response)
        if (response.status !== 101 && response.headers.has('Location')) {
          const location = new URL(response.headers.get('Location'), target)
          if (location.origin === origin) {
            result.headers.set('Location', `${url.origin}${location.pathname}${location.search}${location.hash}`)
          }
        }
        return result
      } catch {
        // Never log tokens, gallery URLs, upstream bodies or connection details.
        return privateResponse(Response.json({ error: 'Backend temporarily unavailable' }, { status: 502 }))
      }
    },
  }
}

export default createWorker()
