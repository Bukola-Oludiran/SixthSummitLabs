/**
 * All site copy and configuration.
 *
 * Edit this file to change the site's content — the components read from it and
 * never hardcode copy of their own.
 */

import printAge from './assets/eras/print.webp'
import sailAge from './assets/eras/sail.webp'
import enlightenmentAge from './assets/eras/enlightenment.webp'
import steamAge from './assets/eras/steam.webp'
import railAge from './assets/eras/rail.webp'
import electricAge from './assets/eras/electric.webp'
import machineAge from './assets/eras/machine.webp'
import networkAge from './assets/eras/network.webp'

/**
 * Image slots for the work section.
 *
 * Each slot renders a labelled placeholder until you give it a source. To fill
 * one, drop the file into `src/assets/`, import it at the top of this file, and
 * assign it below:
 *
 *   import marketplaceShot from './assets/marketplace.png'
 *   ...
 *   work1: marketplaceShot,
 *
 * Site-wide imagery is handled separately by the era backdrop — see `eras`.
 */
export const images = {
  work1: null,
  work2: null,
  work3: null,
}

/** Toggles that were editor props on the original design file. */
export const settings = {
  ctaLabel: 'Book an intro call',
  showMarquee: true,
  showWork: true,
  email: 'hello@sixthsummitlabs.com',
}

export const nav = [
  { label: 'Services', href: '#services' },
  { label: 'Work', href: '#work' },
  { label: 'The route', href: '#route' },
]

export const hero = {
  headline: ['Idea in.', 'Product out.'],
  headlineAccent: 'Fast.',
  lede: 'We design and build MVPs, web and mobile products, and AI agents. One team, no handoffs, and an AI-accelerated pipeline that turns quarters into weeks.',
  stats: [
    { value: '6 weeks', label: 'to first release' },
    { value: '1 team', label: 'design and build' },
    { value: '0 handoffs', label: 'nothing lost between' },
    { value: 'Fixed price', label: 'scoped before we start' },
  ],
}

export const marqueeItems = [
  'MVP builds',
  'Product design',
  'AI agents',
  'Web apps',
  'Mobile apps',
  'Design systems',
  'Technical discovery',
]

/**
 * The era backdrop.
 *
 * A chronological run of city views, one per technological age, drifting
 * continuously behind every section of the page. Order matters — the columns
 * are cut from this sequence, so keep it sorted by year.
 *
 * Every image is public domain or CC0, sourced from Wikimedia Commons and
 * cropped to 3:2. `artist`, `license` and `source` are the provenance record;
 * see src/assets/eras/ATTRIBUTION.md for the full detail.
 */
export const eras = [
  {
    id: 'print',
    year: '1572',
    age: 'The print age',
    place: 'Antwerp',
    image: printAge,
    artist: 'Braun, Hogenberg, Hoefnagel & Novellanus',
    license: 'CC0',
    source:
      'https://commons.wikimedia.org/wiki/File:Anverpia_from_Braun_and_Hogenberg%27s_Civitates_Orbis_Terrarum_MET_DP325824.jpg',
  },
  {
    id: 'sail',
    year: '1630',
    age: 'The age of sail',
    place: 'Amsterdam',
    image: sailAge,
    artist: 'Hendrick Cornelisz Vroom',
    license: 'Public domain',
    source:
      'https://commons.wikimedia.org/wiki/File:VROOM_Hendrick_Cornelisz_The_Harbour_in_Amsterdam.jpg',
  },
  {
    id: 'enlightenment',
    year: '1750',
    age: 'The enlightenment',
    place: 'London',
    image: enlightenmentAge,
    artist: 'Unknown',
    license: 'CC0',
    source:
      'https://commons.wikimedia.org/wiki/File:Gezicht_op_Londen,_asset_pXSWUZ7EAiEsbgR6QgeGE7JR.jpg',
  },
  {
    id: 'steam',
    year: '1801',
    age: 'The age of steam',
    place: 'Coalbrookdale',
    image: steamAge,
    artist: 'Philip James de Loutherbourg',
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Philipp_Jakob_Loutherbourg_d._J._002.jpg',
  },
  {
    id: 'rail',
    year: '1892',
    age: 'The gaslit city',
    place: 'Liverpool',
    image: railAge,
    artist: 'John Atkinson Grimshaw',
    license: 'Public domain',
    source:
      'https://commons.wikimedia.org/wiki/File:John_Atkinson_Grimshaw_(1836-1893)_-_Liverpool_Docks_by_Night_-_WAG_10328_-_Walker_Art_Gallery.jpg',
  },
  {
    id: 'electric',
    year: '1900',
    age: 'The electric metropolis',
    place: 'New York',
    image: electricAge,
    artist: 'Detroit Publishing Co.',
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Mulberry_Street_NYC_c1900_LOC_3g04637u_edit.jpg',
  },
  {
    id: 'machine',
    year: '1948',
    age: 'The neon city',
    place: 'New York',
    image: machineAge,
    artist: 'William P. Gottlieb',
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:52nd_Street,_New_York,_by_Gottlieb,_1948.jpg',
  },
  {
    id: 'network',
    year: '2012',
    age: 'The network age',
    place: 'North America at night',
    image: networkAge,
    artist: 'NASA Earth Observatory',
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:City_Lights_of_the_United_States_2012.jpg',
  },
]

export const services = [
  {
    num: '01',
    tag: '◆',
    title: 'MVP builds',
    body: 'The smallest version of your product that real users can pay for. Scoped, priced and shipped in weeks.',
    meta: '6–8 weeks · fixed price',
  },
  {
    num: '02',
    tag: '◇',
    title: 'Product design',
    body: 'Interfaces designed to be built, not admired. Flows, screens and a system your next developer can pick up.',
    meta: '2–3 weeks · design system included',
  },
  {
    num: '03',
    tag: '△',
    title: 'AI products & agents',
    body: 'Assistants, agents and AI features with real evaluation behind them. Useful on day one, not a demo.',
    meta: '4–6 weeks · evals included',
  },
  {
    num: '04',
    tag: '▲',
    title: 'Web apps',
    body: 'Dashboards, marketplaces, internal tools. Fast, accessible and boring in the places that matter.',
    meta: '6–12 weeks',
  },
  {
    num: '05',
    tag: '◈',
    title: 'Mobile apps',
    body: 'iOS and Android from one codebase. Store submission, analytics and release pipeline handled.',
    meta: '8–12 weeks · store launch',
  },
]

export const projects = [
  {
    slot: 'work1',
    slotHint: 'Drop a product screenshot',
    kind: 'MVP build',
    year: '2026',
    name: 'Client MVP — name pending',
    body: 'A two-sided marketplace taken from whiteboard to paying users in seven weeks.',
    result: 'Live in 7 weeks',
    stack: 'Next.js · Postgres',
  },
  {
    slot: 'work2',
    slotHint: 'Drop a product screenshot',
    kind: 'AI product',
    year: '2025',
    name: 'Internal AI assistant',
    body: 'A document assistant for an operations team, with evaluation harness and audit trail.',
    result: '40% less manual review',
    stack: 'Python · Claude',
  },
  {
    slot: 'work3',
    slotHint: 'Drop a screenshot of your own product',
    kind: 'Own product',
    year: '2025',
    name: 'In-house product',
    body: 'Something we built for ourselves, kept running, and learned from in public.',
    result: 'Still shipping',
    stack: 'React Native',
  },
]

export const steps = [
  {
    when: 'Day 0–3',
    title: 'Basecamp',
    body: 'One call, then a written scope. What we build, what we cut, what it costs.',
    out: '→ Scope + fixed price',
  },
  {
    when: 'Week 1–2',
    title: 'Route',
    body: 'Flows and screens for the whole product. You approve the thing before it is built.',
    out: '→ Clickable design',
  },
  {
    when: 'Week 3–6',
    title: 'Ascent',
    body: 'Build in weekly releases. You use it as it grows. Nothing waits until the end.',
    out: '→ Working build, weekly',
  },
  {
    when: 'Week 7+',
    title: 'Summit',
    body: 'Launch, handover, and the option to keep us on retainer while you find traction.',
    out: '→ Live, and yours',
  },
]

export const principles = [
  {
    title: 'AI does the grunt work',
    body: 'Scaffolding, migrations, test coverage, copy drafts. Our people spend their hours on judgement, not typing.',
  },
  {
    title: 'You see it every week',
    body: 'A working build in your hands every Friday. No black boxes, no status-report fiction.',
  },
  {
    title: 'You own everything',
    body: 'Code, designs, infrastructure, accounts. We hand over the keys and stay on call if you want us.',
  },
]

export const audiences = [
  {
    num: 'A',
    title: 'Founders with an idea and no engineers',
    body: 'You know the problem cold. You need a team that turns it into software without a technical co-founder.',
  },
  {
    num: 'B',
    title: 'Early-stage teams that need to ship faster',
    body: 'You have some product and not enough hands. We take a slice and deliver it end to end.',
  },
  {
    num: 'C',
    title: 'Agencies who need a build partner',
    body: 'You sold the work and need it built well, quietly, under your name. We white-label without drama.',
  },
]

export const contact = {
  badge: 'Two build slots open this quarter',
  title: "Let's find your summit.",
  body: "Thirty minutes. Bring the rough idea. You'll leave with a scope, a timeline and a number.",
}

export const footer = {
  links: [
    { label: 'Services', href: '#services' },
    { label: 'Work', href: '#work' },
    { label: 'Process', href: '#route' },
    { label: 'Contact', href: '#contact' },
  ],
  note: '© 2026 — Built at altitude',
  credit: {
    text: 'Backdrop: city views 1572–2012, public domain and CC0 via',
    linkLabel: 'Wikimedia Commons',
    href: 'https://commons.wikimedia.org/',
  },
}
