import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { normalizePhone, fingerprint, qualify, mergeDiscoveredLead, conceptBriefs } from '../src/leads.mjs'
import { candidateFromElement } from '../src/sources/overpass.mjs'

const pilot = JSON.parse(await readFile(new URL('../config/pilot.json', import.meta.url)))
const now = new Date('2026-10-17T18:00:00Z')
const lead = {
  id: 1, businessName: 'Demonstration Studio', phone: '(306) 555-0101', city: 'Regina', province: 'SK',
  address: '100 Example Street', websiteStatus: 'none_found', websiteCheckedAt: now.toISOString(),
  websiteEvidence: { searches: [{ query: 'name and city', outcome: 'complete' }, { query: 'name and phone', outcome: 'complete' }] },
  logoStatus: 'found', logoAssetPath: 'storage/demo/original.svg', brandPalette: ['#0055aa', '#f0c441'],
}

test('normalizes public Canadian telephone formats and rejects incomplete numbers', () => {
  assert.equal(normalizePhone('+1 (306) 555-0101 ext 24'), '+13065550101')
  assert.equal(normalizePhone('306.555.0101'), '+13065550101')
  assert.equal(normalizePhone('555-0101'), null)
  assert.equal(normalizePhone('130555501'), null)
})

test('email and logo are optional, but a phone and completed website checks are required', () => {
  assert.equal(qualify({ ...lead, email: null, logoStatus: 'not_found' }, pilot, now).qualified, true)
  assert.equal(qualify({ ...lead, phone: '' }, pilot, now).qualified, false)
  assert.equal(qualify({ ...lead, websiteStatus: 'website_found' }, pilot, now).qualified, false)
  assert.equal(qualify({ ...lead, websiteEvidence: { searches: [{ query: 'test', outcome: 'blocked' }] } }, pilot, now).qualified, false)
  assert.equal(qualify({ ...lead, websiteEvidence: { ...lead.websiteEvidence, unresolvedDomains: ['possible-business.ca'] } }, pilot, now).qualified, false)
})

test('stale evidence, non-target cities and do-not-call leads cannot qualify', () => {
  assert.equal(qualify({ ...lead, websiteCheckedAt: '2026-09-01' }, pilot, now).qualified, false)
  assert.equal(qualify({ ...lead, city: 'Toronto', province: 'ON' }, pilot, now).qualified, false)
  assert.equal(qualify({ ...lead, contactStatus: 'do_not_call' }, pilot, now).qualified, false)
})

test('deduplicates spelling and phone formatting while keeping separate locations', () => {
  assert.equal(fingerprint(lead), fingerprint({ ...lead, businessName: 'DEMONSTRATION STUDIO', phone: '+13065550101' }))
  assert.notEqual(fingerprint(lead), fingerprint({ ...lead, address: '200 Example Street' }))
})

test('rediscovery preserves caller assignment, notes and opt-outs', () => {
  const existing = { ...lead, contactStatus: 'do_not_call', assignedTo: 'partner', businessNotes: 'Owner asked us not to call.' }
  const merged = mergeDiscoveredLead(existing, { ...lead, contactStatus: 'new', assignedTo: 'other', businessNotes: 'discard me' })
  assert.equal(merged.contactStatus, 'do_not_call')
  assert.equal(merged.assignedTo, 'partner')
  assert.equal(merged.businessNotes, existing.businessNotes)
})

test('three concepts preserve the original logo and require the brand palette on concept one', () => {
  const concepts = conceptBriefs(lead, pilot)
  assert.equal(concepts.length, 3)
  assert.equal(new Set(concepts.map((concept) => concept.jobKey)).size, 3)
  assert.ok(concepts.every((concept) => concept.brief.originalLogoPath === lead.logoAssetPath))
  assert.deepEqual(concepts[0].brief.requiredPalette, lead.brandPalette)
  assert.deepEqual(concepts.map((concept) => concept.jobKey), conceptBriefs(lead, pilot).map((concept) => concept.jobKey))
  assert.throws(() => conceptBriefs({ ...lead, logoAssetPath: '' }, pilot), /original asset/)
})

test('a missing website tag is only a discovery signal, and listed independent websites are excluded', () => {
  const city = pilot.cities[0]
  const element = { type: 'node', id: 1, tags: { name: lead.businessName, phone: lead.phone, shop: 'hairdresser' } }
  const candidate = candidateFromElement(element, city)
  assert.equal(candidate.websiteStatus, 'not_checked')
  assert.equal(candidate.phone, '+13065550101')
  assert.equal(candidateFromElement({ ...element, tags: { ...element.tags, website: 'https://example.com' } }, city), null)
  assert.ok(candidateFromElement({ ...element, tags: { ...element.tags, website: 'https://facebook.com/example' } }, city))
})
