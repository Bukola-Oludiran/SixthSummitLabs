---
name: vectorcraft-logo
description: Design and refine logos, wordmarks and brand signatures in VectorCraft, with editable masters, outlined SVG exports, optical spacing and small-size/monochrome review. Use for creating or revising a brand identity; preserve supplied original logos when only website concepts or supporting artwork are requested.
---

# VectorCraft Logo

Use VectorCraft to author the actual logo geometry and typography. Deliver a distinctive identity
that survives the business's real applications, with an editable `.vectorcraft` master and inspected
exports. A presentation or a large polished render does not establish that the logo works.

## Establish what the identity needs to do

Confirm the exact name, audience, offer, brand personality, existing assets, observed colours and
likely smallest use. Infer routine choices from the supplied brief; ask only for information that
would change the design. Separate observed motifs from proposed symbolism.

If the task is a website concept and an existing logo is supplied, preserve that original asset.
If its only source is a raster, keep it as the original; do not silently trace, redraw or replace it.
A requested redesign may explore alternatives while keeping the original separately available.

Choose the appropriate signature: wordmark, letterform, symbol with type, emblem or another supported
direction. A separate icon is optional. Look for one memorable formal idea tied to the business;
avoid defaulting to a circle with initials or selecting a stock motif from a keyword. Explore enough
different ideas to make a meaningful choice, without imposing a fixed number on every request.

Read [logo principles](references/logo-principles.md) while developing the mark and type. Use those
criteria to explain choices and revise weak work; do not turn them into a universal house style.

## Construct in VectorCraft

The installed **vectorcraft-draw** skill supplies the headless engine bridge and `vcscene` library.
This skill's wrapper locates it without duplicating the engine code:

```sh
bash <skill-dir>/scripts/vectorcraft.sh check
bash <skill-dir>/scripts/vectorcraft.sh commands text.setStyle
bash <skill-dir>/scripts/vectorcraft.sh run ./logo.py ./logo-output
```

See [VectorCraft production](references/vectorcraft-production.md) for the verified authoring/export
pattern. Build named, editable paths and live type in the master. Use Boolean or compound geometry
for real counters and cutouts; a background-coloured cover is not a transparent hole. Work with
installed, appropriately licensed typefaces and refine the wordmark's actual spacing.

A flat one-colour proof is a useful construction test. Colour, gradients or richer treatments can
support an identity when justified; they should not disguise a weak outline or become the only
usable version. Do not substitute raster generation, an SVG enclosing a bitmap, or hand-authored SVG
for the requested VectorCraft master. Preserve original supplied assets as originals.

## Inspect the identity, then its applications

Export the intended colour treatment plus genuine positive/reversed one-colour variants. Render and
look at the actual exports, including mark-only and wordmark/signature separately when both exist.
Review around 16/24/32/64px for compact marks and realistic header widths for signatures; these are
diagnostics, not a claim that every logo must work at 16px. Record the smallest size that actually
works. Create an optical small-size variant only when it helps the brief, and label it clearly.

The proof helper checks production SVG structure and makes a local comparison page:

```sh
python3 <skill-dir>/scripts/proof.py \
  --mark ./logo-output/mark-black.svg --reverse-mark ./logo-output/mark-white.svg \
  --wordmark ./logo-output/signature-black.svg --reverse-wordmark ./logo-output/signature-white.svg \
  --out ./logo-output/proof
```

Omit mark or wordmark arguments when that form is not part of the identity. Open `proof/index.html`
in an available browser, inspect the sizes and reversed variants, and check rendered PNGs using the
image viewer. `findings.json` checks file structure only; it cannot judge originality, spacing,
silhouette quality, cutout readability or appropriate minimum size. Fix observed problems and
inspect again. Also reopen/render the saved `.vectorcraft` master to check it matches the exports.

When a mark replaces a character in a wordmark, preserve the intended reading of the whole name.
Judge its perceived size and baseline optically, rather than forcing matching bounding-box heights;
check the join to the next letter and avoid typing the replaced character a second time.

## Handoff

Keep the scene script and editable master. Export outlined SVGs for font-independent use, transparent
PNGs at useful sizes, and the relevant light/dark and one-colour variants. Include brief usage notes:
colour values, typeface/source, clear-space recommendation, observed minimum size, supplied-versus-
proposed assets and any unresolved limitation. Add a presentation or additional lockups when useful
or requested; do not require a large kit for a small edit.

For the 6ixSummit lead workflow, preserve an existing business logo across all three homepages. If
none exists, create a coherent proposed identity with this skill, then reuse it across the concepts
unless identity exploration was requested. Respect the observed palette requirement in the brief.
