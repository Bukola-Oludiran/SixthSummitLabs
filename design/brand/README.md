# 6ixSummit Labs — Ascent 6 / Twin Summit

A faceted **6** with two mountain peaks in its negative space. A taller left
summit and a slightly lower right summit share a broad base and open valley.
The rising upper stroke suggests the climb from an idea to a shipped product.

The mark replaces the initial **6** in the wordmark, followed by **ixSummit**
and **Labs**. The mark is 25% larger than the original cap-height treatment,
optically centred beside the letters, with adjusted spacing before the i.
Labs is smaller and quieter, on the same baseline as ixSummit.

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
Inter and JetBrains Mono. The website uses the outlined wordmark directly;
its other heading and body fonts are unchanged.

## Usage

| Property | Value |
| --- | --- |
| Brand blue | `#2563FF` |
| Ink | `#08090A` |
| Pale type | `#F2F5F9` |
| Mark grid | 100 × 100 units |
| Clear space | At least 20 grid units around the standalone mark |
| Minimum standalone size | 16 CSS pixels; prefer 24 or larger for the twin peaks |
| Minimum complete wordmark width | 144 CSS pixels; prefer 200 or larger |

Use the integrated wordmark in the website header and footer. Use the standalone
mark for favicons and avatars. Keep the mountain cutout transparent, preserve
proportions, and use the white version when blue has insufficient contrast
against a dark coloured surface. Do not add another typed 6 after the mark.

## Rebuild

The source of truth is `draw_logo.py`, which draws through VectorCraft's
headless API using the installed `vectorcraft-draw` skill:

```sh
bash /Users/bukolaoludiran/.codex/skills/vectorcraft-draw/scripts/run.sh design/brand/draw_logo.py
```

The generator exports the editable documents, transparent SVGs, PNG previews
and presentation PDF, and refreshes `../6ixsummit-logo-kit.zip`. All exported
SVG lettering is outlined.

Append `--sync-web` to also update the mark and outlined wordmark in
`src/assets/brand/`, `public/favicon.svg`, and the 180px
`public/apple-touch-icon.png`. The header and footer share the exported
wordmark through the `Wordmark` component.
