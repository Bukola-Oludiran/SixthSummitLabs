# Era carousel — image sources

All eight images are **public domain** or **CC0**, sourced from
[Wikimedia Commons](https://commons.wikimedia.org/). None carry a share-alike or
attribution obligation, but they are credited here and in a line beneath the
backdrop because it is the decent thing to do and it records provenance for
whoever maintains this next.

Each file was cropped to 3:2 and re-encoded to WebP at 900×600. Colour grading
is **not** baked in — it is applied at runtime in `EraBackdrop.css`, so the
originals stay neutral and a theme change re-grades them for free.

Every image is a colour original. That is deliberate: the cursor lens reveals
each plate's true colour, so a monochrome source would surface as grey and waste
the effect.

| File                 | Year | Age                     | Creator                      | Licence       |
| -------------------- | ---- | ----------------------- | ---------------------------- | ------------- |
| `renaissance.webp`   | 1599 | The renaissance city    | El Greco                     | CC0           |
| `sail.webp`          | 1630 | The age of sail         | Hendrick Cornelisz Vroom     | Public domain |
| `enlightenment.webp` | 1750 | The enlightenment       | Unknown                      | CC0           |
| `steam.webp`         | 1801 | The age of steam        | Philip James de Loutherbourg | Public domain |
| `rail.webp`          | 1892 | The gaslit city         | John Atkinson Grimshaw       | Public domain |
| `electric.webp`      | 1900 | The electric metropolis | Detroit Publishing Co.       | Public domain |
| `machine.webp`       | 1948 | The neon city           | William P. Gottlieb          | Public domain |
| `network.webp`       | 2014 | The network age         | Carol M. Highsmith           | Public domain |

## Source pages

- **renaissance** — [View of Toledo, c. 1599](https://commons.wikimedia.org/wiki/File:View_of_Toledo_MET_DP349564.jpg) (Metropolitan Museum of Art)
- **sail** — [The Harbour in Amsterdam, 1630](https://commons.wikimedia.org/wiki/File:VROOM_Hendrick_Cornelisz_The_Harbour_in_Amsterdam.jpg)
- **enlightenment** — [Gezicht op Londen, 1750](https://commons.wikimedia.org/wiki/File:Gezicht_op_Londen,_asset_pXSWUZ7EAiEsbgR6QgeGE7JR.jpg) (Rijksmuseum)
- **steam** — [Coalbrookdale by Night, 1801](https://commons.wikimedia.org/wiki/File:Philipp_Jakob_Loutherbourg_d._J._002.jpg)
- **rail** — [Liverpool Docks by Night, 1892](https://commons.wikimedia.org/wiki/File:John_Atkinson_Grimshaw_(1836-1893)_-_Liverpool_Docks_by_Night_-_WAG_10328_-_Walker_Art_Gallery.jpg) (Walker Art Gallery)
- **electric** — [Mulberry Street, New York, c. 1900](https://commons.wikimedia.org/wiki/File:Mulberry_Street_NYC_c1900_LOC_3g04637u_edit.jpg) — photochrom, Library of Congress
- **machine** — [52nd Street, New York, 1948](https://commons.wikimedia.org/wiki/File:52nd_Street,_New_York,_by_Gottlieb,_1948.jpg) (William P. Gottlieb collection, Library of Congress)
- **network** — [Downtown Dallas at dusk, 2014](https://commons.wikimedia.org/wiki/File:Downtown_Dallas_at_dusk.jpg) (Carol M. Highsmith Archive, Library of Congress)

## Replacing or adding an era

1. Find a public-domain or CC0 image on Commons and note its file page URL.
2. Crop to 3:2 and export WebP at roughly 900×600.
3. Drop it in this folder, then add an entry to `eras` in `src/site.config.js` —
   import the file, and fill in `year`, `age`, `place`, `artist`, `license` and
   `source`.
4. Keep `eras` sorted by year. The backdrop columns are cut from the sequence,
   and the loop speeds in `EraBackdrop.jsx` assume an even run of slides.
5. Record it in the table above.
