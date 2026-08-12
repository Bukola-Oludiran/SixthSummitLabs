# Era carousel — image sources

All eight images are **public domain** or **CC0**, sourced from
[Wikimedia Commons](https://commons.wikimedia.org/). None carry a share-alike or
attribution obligation, but they are credited here and in a line beneath the
carousel because it is the decent thing to do and it records provenance for
whoever maintains this next.

Each file was cropped to 3:2 and re-encoded to WebP at 900×600. Colour grading
is **not** baked in — it is applied at runtime in `EraCarousel.css`, so the
originals stay neutral and a theme change re-grades them for free.

| File               | Year | Age                     | Creator                                    | Licence       |
| ------------------ | ---- | ----------------------- | ------------------------------------------ | ------------- |
| `print.webp`       | 1572 | The print age           | Braun, Hogenberg, Hoefnagel & Novellanus   | CC0           |
| `sail.webp`        | 1611 | The age of sail         | Pieter Bast & Claes Janszoon Visscher II   | Public domain |
| `enlightenment.webp` | 1750 | The enlightenment     | Unknown                                    | CC0           |
| `steam.webp`       | 1801 | The age of steam        | Philip James de Loutherbourg               | Public domain |
| `rail.webp`        | 1872 | The railway city        | Gustave Doré                               | Public domain |
| `electric.webp`    | 1921 | The electric metropolis | Irving Underhill                           | Public domain |
| `machine.webp`     | 1945 | The machine age         | Tom Blackmore (restoration)                | Public domain |
| `network.webp`     | 2012 | The network age         | NASA Earth Observatory                     | Public domain |

## Source pages

- **print** — [Anverpia, from Braun and Hogenberg's *Civitates Orbis Terrarum*](https://commons.wikimedia.org/wiki/File:Anverpia_from_Braun_and_Hogenberg%27s_Civitates_Orbis_Terrarum_MET_DP325824.jpg) (Metropolitan Museum of Art)
- **sail** — [Profile of Amsterdam, 1611](https://commons.wikimedia.org/wiki/File:Profile_of_Amsterdam,_1611.jpg)
- **enlightenment** — [Gezicht op Londen, 1750](https://commons.wikimedia.org/wiki/File:Gezicht_op_Londen,_asset_pXSWUZ7EAiEsbgR6QgeGE7JR.jpg) (Rijksmuseum)
- **steam** — [Coalbrookdale by Night, 1801](https://commons.wikimedia.org/wiki/File:Philipp_Jakob_Loutherbourg_d._J._002.jpg)
- **rail** — [*London: A Pilgrimage*, 1872](https://commons.wikimedia.org/wiki/File:YCBA_London_a_Pilgrimage_06_(cropped).jpg) (Yale Center for British Art)
- **electric** — [New York skyline from Jersey City, 1921](https://commons.wikimedia.org/wiki/File:New_York_skyline_from_Jersey_City_LCCN97519723.jpg) (Library of Congress)
- **machine** — [Panorama of Manhattan's West Side, 1945](https://commons.wikimedia.org/wiki/File:Panorama_of_Manhattan%27s_West_Side_from_Across_the_Hudson,_restored.jpg)
- **network** — [City Lights of the United States, 2012](https://commons.wikimedia.org/wiki/File:City_Lights_of_the_United_States_2012.jpg) (NASA Earth Observatory)

## Replacing or adding an era

1. Find a public-domain or CC0 image on Commons and note its file page URL.
2. Crop to 3:2 and export WebP at roughly 900×600.
3. Drop it in this folder, then add an entry to `eras` in `src/site.config.js` —
   import the file, and fill in `year`, `age`, `place`, `artist`, `license` and
   `source`.
4. Keep `eras` sorted by year. The carousel reads as a timeline, and the loop
   duration in `EraCarousel.css` assumes a roughly even run of slides.
5. Record it in the table above.
