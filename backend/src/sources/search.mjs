import { normalizePhone } from '../leads.mjs'

const profiles = ['facebook.com', 'instagram.com', 'tiktok.com', 'linkedin.com', 'youtube.com']
const directories = ['yellowpages.ca', 'yelp.ca', 'yelp.com', 'bbb.org', 'canada411.ca', 'openstreetmap.org', 'mapquest.com', 'tripadvisor.ca', 'tripadvisor.com', 'google.com', 'bing.com']
const platforms = ['square.site', 'squareup.com', 'fresha.com', 'booksy.com', 'linktr.ee']
const inDomains = (host, domains) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`))

export async function checkWebsite(lead, { endpoint, fetch: request = globalThis.fetch, now = new Date() } = {}) {
  if (!endpoint) throw new Error('Configure a permitted SearXNG JSON endpoint before automated website verification.')
  const queries = [`"${lead.businessName}" "${lead.city}" official website`, `"${normalizePhone(lead.phone)}" "${lead.businessName}"`]
  const searches = []
  const unresolvedDomains = new Set()
  const socialLinks = new Set(lead.socialLinks || [])
  let platformFound = false
  for (const query of queries) {
    try {
      const url = new URL('search', endpoint.endsWith('/') ? endpoint : `${endpoint}/`)
      url.search = new URLSearchParams({ q: query, format: 'json', language: 'en-CA', categories: 'general' }).toString()
      const response = await request(url, { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('Search unavailable.')
      const data = await response.json()
      if (!Array.isArray(data.results) || data.unresponsive_engines?.length || !data.results.length) throw new Error('Search returned incomplete or empty evidence.')
      const results = data.results.slice(0, 20).map((entry) => ({ title: entry.title, url: entry.url, snippet: entry.content || '' }))
      for (const entry of results) {
        const url = new URL(entry.url)
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unexpected result URL.')
        const host = url.hostname.toLowerCase().replace(/^www\./, '')
        if (inDomains(host, profiles)) socialLinks.add(entry.url)
        else if (inDomains(host, platforms)) platformFound = true
        else if (!inDomains(host, directories)) unresolvedDomains.add(host)
      }
      searches.push({ query, outcome: 'complete', results })
    } catch {
      searches.push({ query, outcome: 'failed', results: [] })
    }
  }
  const uncertain = searches.some((search) => search.outcome !== 'complete') || unresolvedDomains.size > 0
  return {
    ...lead,
    websiteStatus: uncertain ? 'uncertain' : platformFound ? 'platform_only' : socialLinks.size ? 'social_only' : 'none_found',
    websiteCheckedAt: now.toISOString(),
    websiteEvidence: { provider: 'searxng', searches, unresolvedDomains: [...unresolvedDomains] },
    socialLinks: [...socialLinks],
  }
}
