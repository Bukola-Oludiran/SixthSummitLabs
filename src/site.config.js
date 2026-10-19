/**
 * Marketing copy and configuration for 6ixSummit Labs.
 * Keep claims grounded in the portfolio and agreed service scope.
 * Copywriting sources and review notes: design/brand/website-copy-review.json.
 */

import renaissanceAge from './assets/eras/renaissance.webp'
import sailAge from './assets/eras/sail.webp'
import enlightenmentAge from './assets/eras/enlightenment.webp'
import steamAge from './assets/eras/steam.webp'
import railAge from './assets/eras/rail.webp'
import electricAge from './assets/eras/electric.webp'
import machineAge from './assets/eras/machine.webp'
import networkAge from './assets/eras/network.webp'
import luxeStyleBraids from './assets/luxestylebraids.jpg'
import ayoeEventHouse from './assets/portfolio/ayoe-event-house.jpg'
import akiliDevelopmentGroup from './assets/portfolio/akili-development-group.jpg'

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
  work1: luxeStyleBraids,
  work2: ayoeEventHouse,
  work3: akiliDevelopmentGroup,
}

/** Toggles that were editor props on the original design file. */
export const settings = {
  ctaLabel: 'Discuss your project',
  headerCtaLabel: 'Let’s talk',
  emailCtaLabel: 'Email your idea',
  showMarquee: true,
  showWork: true,
  email: 'hello@6ixsummitlabs.com',
}

export const nav = [
  { label: 'Services', href: '#services' },
  { label: 'Work', href: '#work' },
  { label: 'How we work', href: '#route' },
]

export const hero = {
  headline: ['Websites built', 'around your'],
  headlineAccent: 'business.',
  lede: 'We design and build websites that show what you do and help customers get in touch. We also build booking tools, custom apps and automations for the work behind the scenes.',
  secondaryCta: 'See our work',
  stats: [
    { value: 'Websites', label: 'Show what you do' },
    { value: 'Brand design', label: 'Keep your look consistent' },
    { value: 'Custom apps', label: 'Support your daily work' },
    { value: 'Automation', label: 'Connect routine tasks' },
  ],
}

export const marqueeItems = [
  'Business websites',
  'Brand and web design',
  'Online bookings',
  'Workflow automation',
  'Custom web apps',
  'Mobile apps',
  'AI assistants',
]

export const sectionCopy = {
  services: {
    eyebrow: '01 — What we can help with',
    title: 'A website is a good place to start.',
    body: 'Help customers understand your services and get in touch. Add booking tools, custom software or automation when your business needs them.',
    helpTitle: 'Still working out what you need?',
    helpBody: 'Tell us what you want customers or staff to be able to do. We’ll help you work out what to build first.',
  },
  work: {
    eyebrow: '02 — Selected work',
    title: 'See what we’ve built.',
    cta: 'Discuss a similar project',
  },
  process: {
    eyebrow: '03 — How we work',
    title: 'You have a say at every step.',
  },
  audiences: {
    eyebrow: '04 — Who we work with',
    title: 'Start with what your business needs.',
    body: 'Your first website, a new product idea or a process that needs less manual work. We’ll help you choose a starting point.',
  },
}

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
    id: 'renaissance',
    year: '1599',
    age: 'The renaissance city',
    place: 'Toledo',
    image: renaissanceAge,
    artist: 'El Greco',
    license: 'CC0',
    source: 'https://commons.wikimedia.org/wiki/File:View_of_Toledo_MET_DP349564.jpg',
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
    year: '2014',
    age: 'The network age',
    place: 'Dallas',
    image: networkAge,
    artist: 'Carol M. Highsmith',
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Downtown_Dallas_at_dusk.jpg',
  },
]

export const services = [
  {
    num: '01',
    tag: '◆',
    title: 'Business websites',
    body: 'Make it easy to explore your services, find your contact details and send an enquiry. We build a website around what your customers need to know.',
    meta: 'Service pages · enquiry forms',
  },
  {
    num: '02',
    tag: '◇',
    title: 'Brand and web design',
    body: 'Give your logo and website a consistent look. We can work with your existing identity or develop a new one with you.',
    meta: 'Logos · layouts · brand colours',
  },
  {
    num: '03',
    tag: '△',
    title: 'Automation and AI',
    body: 'Connect enquiries, follow-ups and the tools you use each day. We build workflows that move information between them and use AI where it fits the task.',
    meta: 'Lead tracking · AI assistants',
  },
  {
    num: '04',
    tag: '▲',
    title: 'Web apps and business tools',
    body: 'Manage bookings, customer records or daily operations in software built around your process. Start with the features your team needs most.',
    meta: 'Booking tools · customer portals',
  },
  {
    num: '05',
    tag: '◈',
    title: 'Mobile apps',
    body: 'Give customers or staff a way to book, check information or manage work from their phone. We design and build an app around those tasks.',
    meta: 'Customer apps · tools for teams',
  },
]

export const projects = [
  {
    slot: 'work1',
    alt: 'Portrait of a woman holding hairstyling combs and scissors',
    imagePosition: '50% 38%',
    kind: 'Web app',
    year: '2026',
    name: 'LuxeStyleBraids',
    href: 'https://luxestylebraids.com',
    body: 'A booking website for a Regina braiding studio, with appointment scheduling, deposits and a dashboard for the owner.',
    result: 'Bookings and studio management',
  },
  {
    slot: 'work2',
    alt: 'Ayoé Event House homepage featuring an elegant wedding table setting',
    imagePosition: 'top',
    kind: 'Website',
    name: 'Ayoé Event House',
    href: 'https://ayoeevents.com',
    body: 'A website for an Edmonton event house, bringing its wedding, social and corporate event services together with an enquiry form.',
    result: 'Event services and enquiries',
  },
  {
    slot: 'work3',
    alt: 'AKILI Development Group homepage featuring an aerial view of a highway interchange',
    imagePosition: 'top',
    kind: 'Website',
    name: 'AKILI Development Group',
    href: 'https://akilidevgroup.com',
    body: 'An English and French website for a project and construction management firm, explaining its services and infrastructure work across Africa.',
    result: 'English and French content',
  },
]

export const steps = [
  {
    when: 'Step 01',
    title: 'Start with your business',
    body: 'Tell us what you do and what you need. We agree the scope, cost and next steps before work begins.',
    out: 'An agreed project scope',
  },
  {
    when: 'Step 02',
    title: 'See the design',
    body: 'You review the layouts and see how people will use the website or app. We refine the design with your feedback.',
    out: 'A design you’ve reviewed',
  },
  {
    when: 'Step 03',
    title: 'Build and review',
    body: 'We build the agreed features and share working versions for you to try. Your feedback helps us catch problems before launch.',
    out: 'Working pages and features',
  },
  {
    when: 'Step 04',
    title: 'Launch and hand over',
    body: 'We check the finished work, help you get it online and walk you through managing it. We agree any ongoing support with you.',
    out: 'Your website or app, ready to use',
  },
]

export const principles = [
  {
    title: 'Your existing brand, respected',
    body: 'Already have a logo and colours? We work with them so your website feels like part of your business.',
  },
  {
    title: 'Progress you can review',
    body: 'We share designs and working pages along the way. You can see what is changing and give feedback while it is being built.',
  },
  {
    title: 'A clear handover',
    body: 'We explain how to manage your website and which accounts and services it uses. Support after launch is discussed as part of the project.',
  },
]

export const audiences = [
  {
    num: 'A',
    title: 'Small businesses getting online',
    body: 'You need a place to show your services and help customers reach you. We’ll help you build your first website or improve the one you have.',
  },
  {
    num: 'B',
    title: 'Founders testing a product idea',
    body: 'You have an idea for an app or service. We help you define a focused first version, design it and build something people can try.',
  },
  {
    num: 'C',
    title: 'Teams with work to simplify',
    body: 'Enquiries, records and follow-ups take time to manage. We build tools and automations around the way your team works.',
  },
]

export const contact = {
  badge: 'Start with a conversation',
  title: 'Tell us what you have in mind.',
  body: 'You can start with a rough idea. Email us what your business does and what you’d like your website or software to handle.',
}

export const footer = {
  links: [
    { label: 'Services', href: '#services' },
    { label: 'Work', href: '#work' },
    { label: 'Process', href: '#route' },
    { label: 'Contact', href: '#contact' },
    { label: 'Your designs', href: '/designs' },
    { label: 'Team CRM', href: '/crm' },
  ],
  note: '© 2026 6ixSummit Labs',
  credit: {
    text: 'Backdrop: city views 1599–2014, public domain and CC0 via',
    linkLabel: 'Wikimedia Commons',
    href: 'https://commons.wikimedia.org/',
  },
}
