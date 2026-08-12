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

The three project cards in the work section render a labelled placeholder until
you supply a screenshot. To fill one:

1. Drop the file into `src/assets/`.
2. Import it at the top of `src/site.config.js` and assign it:

```js
import marketplaceShot from './assets/marketplace.png'

export const images = {
  work1: marketplaceShot,
  work2: null,
  work3: null,
}
```

Site-wide imagery is handled separately by the era backdrop, below.

## The era backdrop

City views from 1572 to 2012 — print, sail, steam, rail, electricity, the
network — drifting continuously behind every section as the page's ground.
It is fixed to the viewport, so it keeps moving wherever the visitor has
scrolled, and it is decorative: hidden from assistive tech and inert to
pointers.

- **Content** lives in `eras` in [`src/site.config.js`](src/site.config.js), one
  entry per age. Keep it sorted by year — the columns are cut from that sequence.
- **Images** are in [`src/assets/eras/`](src/assets/eras/), all public domain or
  CC0 from Wikimedia Commons, cropped to 3:2 at 900×600 (~600KB total).
  Provenance and instructions for swapping one out are in
  [`ATTRIBUTION.md`](src/assets/eras/ATTRIBUTION.md); the footer carries a credit.
- **Colour grading is applied in CSS**, not baked into the files: the artwork is
  desaturated and sunk towards the page ground, then brand blue is laid over the
  whole layer with a `color` blend, which takes the hue from the overlay and
  keeps the artwork's luminance. Change `--brand` and it all re-grades. Tune via
  `.backdrop__img`, `.backdrop__tint` and `.backdrop__scrim` in
  [`EraBackdrop.css`](src/components/EraBackdrop.css).
- **Motion is pure CSS.** Three columns start at different points in the sequence
  and travel at slightly different speeds so they never line up into a grid. Each
  renders its run twice and slides up 50%, landing the second copy exactly where
  the first began. Speeds are the `COLUMNS` array in
  [`EraBackdrop.jsx`](src/components/EraBackdrop.jsx). Reduced motion freezes it
  in place rather than hiding it.

### The cursor lens

Moving the cursor reveals the artwork's original colour through a disc of
square tiles — solid in the middle, dissolving into scattered tiles at the rim.
It is what the blue grading is hiding: warm paper on the engravings, amber city
lights on the NASA plate.

It works by rendering the columns a second time with no grading at all, stacked
above the tint and scrim, and showing that copy only through a moving
`mask-image`. Both copies mount in the same commit and share the same animation
definitions, so they stay in step.

Knobs are the options to `useCursorLens()` in
[`EraBackdrop.jsx`](src/components/EraBackdrop.jsx):

| Option      | Default | Does                                                          |
| ----------- | ------- | ------------------------------------------------------------- |
| `tileRem`   | `2`     | Size of each square in the mask                                |
| `sizeRem`   | `26`    | Diameter of the lens (snapped down to whole tiles)             |
| `coreRatio` | `0.58`  | Fraction of the radius that stays solid before tiles thin out  |

`coreRatio` is the one that changes the character most: drop it toward `0.3` and
the reveal becomes mostly scatter, which looks like static and loses the image.

A cursor move costs two CSS custom-property writes and nothing else — no React
render, no layout — which holds a steady frame rate while the backdrop is also
animating. The lens is skipped entirely on coarse pointers, since there is no
cursor to follow on a touchscreen.

One tradeoff to be aware of: the revealed artwork is shown at full brightness,
so where the lens passes under pale imagery it lifts the area behind the
headline and slightly softens the contrast of white text over it. That is the
cost of showing genuinely true colour. If it ever bothers you, a
`filter: brightness(0.85)` on `.backdrop__cols--true .backdrop__img` takes the
edge off without changing hue.

Two things to know before editing the backdrop:

**Spacing is a `margin-bottom`, not a flex `gap`, and that matters.** With a gap,
a track of 2N slides is `2N·h + (2N−1)·g` tall, so `translateY(-50%)` lands one
gap short of the seam and the loop jumps every cycle. As a margin each slide
contributes exactly `h + m`, and half the track is precisely one sequence.

**The slides deliberately avoid `loading="lazy"`.** Native lazy loading judges an
image by its position in the document, but these sit inside a clipped, animated
track — the browser reads them as far off-screen and leaves them blank while they
are visibly cycling past. Sources are attached on the first effect instead, which
still lets the hero paint first, and `fetchpriority="low"` keeps them from
competing with fonts and the bundle.

## Readability over the backdrop

Because the backdrop sits under every section, card and bar surfaces use the
`--surface-glass` / `--bg-glass` tokens rather than the opaque `--surface` /
`--bg`, so the imagery reads faintly through them instead of being boxed out.
If you add a new card, reach for the glass tokens. If text ever feels hard to
read, the two dials are `.backdrop__scrim` (how far back the imagery sits) and
the `opacity` on `.backdrop__img`.

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
