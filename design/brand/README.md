# 6ixSummit Labs — Ascent 6

A faceted **6** with a summit in its negative space. The rising upper stroke
suggests the climb from an idea to a shipped product. Solid geometry gives the
studio a recognisable signature in the website's existing electric blue.

## Files

- `6ixsummit-logo-presentation.png` / `.pdf`: the design and its applications.
- `6ixsummit-logo-dark.svg`: blue mark and pale wordmark for dark backgrounds.
- `6ixsummit-logo-light.svg`: blue mark and ink wordmark for light backgrounds.
- `6ixsummit-logo-black.svg` / `-white.svg`: complete one-colour signatures.
- `6ixsummit-mark-{blue,black,white}.svg`: standalone marks, including favicons.
- `6ixsummit-avatar.svg` / `.png`: a 512 × 512 social avatar.
- Matching PNGs are transparent except the presentation and avatar.
- Matching `.vectorcraft` documents retain editable paths and live typography.

SVG wordmarks use outlined lettering, so they do not require installed fonts.
Editable documents use Inter Semi Bold / Medium; presentation annotations use
Inter and JetBrains Mono. The website's display typography is unchanged.

## Usage

| Property | Value |
| --- | --- |
| Brand blue | `#2563FF` |
| Ink | `#08090A` |
| Pale type | `#F2F5F9` |
| Mark grid | 100 × 100 units |
| Clear space | At least 20 grid units around the standalone mark |
| Minimum standalone size | 16 CSS pixels; prefer 24 or larger |
| Minimum complete logo width | 240 CSS pixels |

Use the standalone mark beside the site's existing text at compact header
sizes. Keep the counter transparent, preserve proportions, and use the white
version when blue has insufficient contrast against a dark coloured surface.

## Rebuild

The source of truth is `draw_logo.py`, which draws through VectorCraft's
headless API using the installed `vectorcraft-draw` skill:

```sh
bash /Users/bukolaoludiran/.codex/skills/vectorcraft-draw/scripts/run.sh design/brand/draw_logo.py
```

The generator exports the editable documents, transparent SVGs, PNG previews
and presentation PDF, and refreshes `../6ixsummit-logo-kit.zip`. All exported
SVG lettering is outlined.

Append `--sync-web` to also update `src/assets/brand/6ixsummit-mark-blue.svg`,
`public/favicon.svg`, and the 180px `public/apple-touch-icon.png`. The header
and footer share the exported mark through the `Logo` component; their compact
wordmarks use the website's existing display font.
