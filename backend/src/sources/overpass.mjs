import { normalizePhone } from '../leads.mjs'

const publicPlatforms = ['facebook.com', 'instagram.com', 'linktr.ee', 'square.site', 'squareup.com', 'fresha.com', 'booksy.com']

export function overpassQuery(city) {
  if (!/^[A-Za-z ]+$/.test(city.name)) throw new Error('Unsupported city name.')
  return `[out:json][timeout:40];
area["ISO3166-1"="CA"][admin_level=2]->.country;
area["name"="${city.name}"][admin_level=8](area.country)->.city;
(
  nwr(area.city)[shop][name][~"^(contact:)?phone$"~"."];
  nwr(area.city)[craft][name][~"^(contact:)?phone$"~"."];
  nwr(area.city)[office][name][~"^(contact:)?phone$"~"."];
  nwr(area.city)[amenity~"^(restaurant|cafe|fast_food|bar|pub|pharmacy|dentist|veterinary|car_wash|fuel|clinic|driving_school)$"][name][~"^(contact:)?phone$"~"."];
);
out center tags;`
}

export function candidateFromElement(element, city, observedAt = new Date().toISOString()) {
  const tags = element.tags || {}
  const phone = normalizePhone(tags['contact:phone'] || tags.phone)
  if (!tags.name || !phone || tags.disused === 'yes' || tags.abandoned === 'yes' || tags['disused:shop']) return null
  const website = tags['contact:website'] || tags.website
  if (website) {
    try {
      const host = new URL(website.includes('://') ? website : `https://${website}`).hostname.replace(/^www\./, '')
      if (!publicPlatforms.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null
    } catch { return null }
  }
  const socialLinks = [tags['contact:facebook'], tags['contact:instagram'], ...(website ? [website] : [])].filter(Boolean)
  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`
  return {
    businessName: tags.name,
    phone,
    email: tags['contact:email'] || tags.email || null,
    category: tags.shop || tags.craft || tags.office || tags.amenity,
    city: city.name,
    province: city.province,
    country: 'CA',
    address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:unit'] && `Unit ${tags['addr:unit']}`].filter(Boolean).join(' '),
    socialLinks,
    websiteStatus: 'not_checked',
    source: {
      sourceKey: `osm:${element.type}:${element.id}`,
      sourceName: 'OpenStreetMap', sourceUrl, observedAt,
      facts: { businessName: tags.name, phone, category: tags.shop || tags.craft || tags.office || tags.amenity, listedWebsite: website || null },
      attribution: '© OpenStreetMap contributors — ODbL 1.0. https://www.openstreetmap.org/copyright',
      retentionNotes: 'Open data; retain source attribution and applicable ODbL terms.',
    },
  }
}

export async function discover(city, { endpoint = 'https://overpass-api.de/api/interpreter', fetch: request = globalThis.fetch } = {}) {
  const response = await request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': '6ixSummitLeadStudio/0.1 (+https://github.com/Bukola-Oludiran/SixthSummitLabs)' },
    body: new URLSearchParams({ data: overpassQuery(city) }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) throw new Error(`Open business discovery failed (${response.status}).`)
  const result = await response.json()
  if (result.remark) throw new Error('Open business discovery returned an incomplete result; retry later.')
  if (!Array.isArray(result.elements)) throw new Error('Open business discovery returned an invalid response.')
  return result.elements.map((element) => candidateFromElement(element, city)).filter(Boolean)
}
