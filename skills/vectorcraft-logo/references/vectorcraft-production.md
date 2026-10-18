# VectorCraft logo production

The bridge is supplied by the installed `vectorcraft-draw` skill. Override its directory with
`VECTORCRAFT_DRAW_SKILL_DIR`, or set `CODEX_SKILLS_DIR` for a nonstandard skills installation.
`VECTORCRAFT_DIR` selects the application checkout. The wrapper preserves these environment values.
Check the local binary and inspect exact commands before guessing API parameters.

```sh
bash <skill-dir>/scripts/vectorcraft.sh check
bash <skill-dir>/scripts/vectorcraft.sh commands pathfinder
bash <skill-dir>/scripts/vectorcraft.sh commands document.export
```

Create a scene script with the actual identity geometry. The following is an export pattern, not a
logo template; replace the empty authoring section with the design for the brief.

```python
from pathlib import Path
import sys
from vcscene import Scene

out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
s = Scene(800, 240, name="Business / signature")
# Author the business-specific paths and live text here using s.path, s.shape and s.text.
# Name the groups and keep the logo's background transparent.
s.run("select.none")
s.run("document.export", path=str(out / "signature.svg"), format="svg",
      svg={"outlineText": True, "preserveEditing": False,
           "metadata": False, "responsive": True, "decimals": 3})
s.finish(str(out), "signature", extra_scales=(2,))
```

Run it through `scripts/vectorcraft.sh run logo.py output`. This imports `vcscene` without adding
another copy of the engine bridge. If the dependency or binary is absent, report the setup issue;
do not quietly draw in another tool and claim a VectorCraft source file.

Useful mechanics:

- Coordinates are document pixels, top-left origin, y downward. Draw order is paint order.
- `s.path(points=[(x,y), ...], fill="#123456", name="…")` creates editable filled geometry.
  Cubic path data is also supported through `d=` when required by the shape.
- `s.text("Business", x=…, y=…, size=…, font="…", color="#123456")` retains live type.
  Use `s.run("text.fontList")` to inspect installed fonts and `text.setStyle` for exact style,
  size and tracking. The tracking unit is 1/1000 em. Check the actual text baseline visually.
- `s.run("paint.setFill", ids=[...], color="#000000")` can recolour the intended objects for a
  true monochrome export. Keep the colour master separately; avoid accidentally recolouring supplied
  original assets. Use a shared drawing function/geometry for variants to prevent positional drift.
- Inspect `pathfinder` commands for real union/subtract operations; do not assume their selection
  order or returned IDs. A compound path/counter must remain transparent in the exported SVG.
- Clear the selection before whole-document export. Tight artboards or selection exports avoid
  excessive whitespace; retain the chosen clear space in application guidance, not as arbitrary
  padding that makes a header logo appear undersized.
- `document.export` with SVG `outlineText: True` produces the font-independent deliverable while
  `s.finish` saves the editable master with live typography and PNG renders. Check returned warnings;
  the presence of a file alone does not confirm complete glyphs or preserved appearance.
- Reopen a master with `scripts/vectorcraft.sh render signature.vectorcraft reopened.png`. Also
  render the production SVG and compare their visible geometry and letter spacing. The proof helper
  cannot make that comparison for you.

For a wordmark-only brief, review the wordmark and relevant lockups without inventing a separate
icon. For an icon-only edit, preserve the approved typography unless the request changes it.
