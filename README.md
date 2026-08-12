# SixthSummit Labs

Marketing site for SixthSummit Labs, built with Vite and React.

Ported from the `SixthSummit Labs branding.zip` design export (`.dc.html`), which
used a proprietary template runtime. The visual design is unchanged; the
templating, styling and behaviour have been rebuilt as standard React.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

| Command           | Does                                       |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | Dev server with hot reload                 |
| `npm run build`   | Production build into `dist/`              |
| `npm run preview` | Serve the production build locally         |

## Editing the site

**All copy lives in [`src/site.config.js`](src/site.config.js).** Components read
from it and contain no hardcoded text, so most content changes are a one-file
edit.

That file also holds:

- `settings` — the CTA label, contact email, and toggles for the marquee and
  work sections (these were editor props on the original design file).
- `images` — the image slots (see below).

**Colours, fonts and spacing live in
[`src/styles/tokens.css`](src/styles/tokens.css)** as CSS custom properties.
Rebranding is a matter of changing values there rather than hunting through
components.

## Image slots

The design export had drag-and-drop image placeholders. Here they render a
labelled placeholder until you supply a source. To fill one:

1. Drop the file into `src/assets/`.
2. Import it at the top of `src/site.config.js` and assign it:

```js
import heroMountain from './assets/mountain.jpg'

export const images = {
  heroMountain,
  ctaMountain: null,
  work1: null,
  // ...
}
```

The hero and CTA slots behave as "plates": once filled they expand to bleed off
the section edges and are automatically desaturated and dimmed so headline text
stays legible on top. The three `work*` slots are ordinary project screenshots.

## The era carousel

A vertical carousel of city views, one per technological age, running 1572 to
2012. It sits between the marquee and the services grid.

- **Content** lives in `eras` in [`src/site.config.js`](src/site.config.js), one
  entry per age. Keep it sorted by year — the carousel reads as a timeline.
- **Images** are in [`src/assets/eras/`](src/assets/eras/), all public domain or
  CC0 from Wikimedia Commons, cropped to 3:2 at 900×600. Full provenance and
  instructions for swapping one out are in
  [`ATTRIBUTION.md`](src/assets/eras/ATTRIBUTION.md).
- **Colour grading is applied in CSS**, not baked into the files: the images are
  desaturated and darkened, then the brand blue is laid over with a `color`
  blend, which takes the hue from the overlay and keeps the artwork's luminance.
  Change `--brand` and every image re-grades. Adjust the look in the
  `.era__img` / `.era__tint` / `.era__frame` rules of `EraCarousel.css`.
- **Motion is pure CSS.** The sequence is rendered twice and the track slides up
  by exactly 50%, so the second copy lands where the first began and the loop
  never seams. Change the speed via the `eraScroll` animation duration. It pauses
  on hover, and reduced-motion visitors get a static, scrollable column instead.

One caveat worth knowing if you edit it: the slides deliberately do **not** use
`loading="lazy"`. Native lazy loading judges an image by its position in the
document, but these sit thousands of pixels down inside a clipped, animated
track — the browser reads them as far off-screen and leaves them blank while
they are visibly cycling past. Instead `useNearViewport` watches the section and
attaches all eight sources as it approaches.

## Structure

```
src/
├─ main.jsx              Entry point
├─ App.jsx               Page composition
├─ site.config.js        All copy and configuration
├─ styles/
│  ├─ tokens.css         Design tokens
│  └─ global.css         Reset, keyframes, shared section/button classes
├─ hooks/
│  └─ useParallax.js     Scroll depth effect for the hero ridge and CTA plate
└─ components/           One component + stylesheet per section
```

### Notes on behaviour

- **`Reveal`** fades sections in as they scroll into view. Content already
  on screen at load is shown immediately, so nothing above the fold animates in.
- **`useParallax`** moves any element carrying `data-depth="0.42"` as the page
  scrolls — higher values drift further. Adding `data-scale` also grows it
  slightly. Scroll writes are batched into a single `requestAnimationFrame`.
- Both respect `prefers-reduced-motion`, as do the marquee and the page's
  entrance animations.

## Fonts

Space Grotesk (display), Instrument Sans (body) and JetBrains Mono (labels) load
from Google Fonts in `index.html`. To self-host, drop the woff2 files into
`public/` and replace the `<link>` with an `@font-face` block in `global.css`.
