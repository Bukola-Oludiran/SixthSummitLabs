# Prospect homepage design standard

Apply this to every homepage concept in the daily routine. The target is a business-specific,
complete visual proposal with meaningful imagery. Thirty mechanically valid pages are not thirty
successful designs. Keep draft approval and publication with staff.

## Resolve the visual direction and media before authoring

Read ASA Page's `references/art-direction.md`. Prepare a shared media kit alongside the business's
logo and facts. Keep each asset's source or generation provenance, reuse status and local filename
in `ASSET-PROVENANCE.json` outside the checkout. Use original business photos when usable; properly
licensed stock or generated conceptual imagery can illustrate the trade when originals are missing.
Use an available image-generation skill/tool for appropriate conceptual photography. Do not silently
fall back to blank panels or logos when obtaining photographs takes more work. Report a media blocker
if suitable imagery cannot be obtained.

Every concept needs at least one substantial local photograph or purpose-made content illustration
near its opening, at desktop and mobile widths. Logos, brand signatures, icons, gradients and simple
decorative CSS shapes do not count. Visual trades benefit from supporting images with different
subjects or details when these add information. Decide image selection, crop and focal point for
each concept, rather than placing the same picture into the same right-hand rectangle three times.
Stock and generated imagery must not imply the business owns a pictured shop, employs pictured people,
sells a pictured product or completed a pictured project. Keep that distinction in asset provenance;
do not describe conceptual imagery as an actual business portfolio.

Before fan-out, write `ART-DIRECTION.md` with one paragraph per concept: business cue, visual thesis,
opening composition, type relationship, image role/crop, section rhythm and primary action. Concept
labels describe communication priorities, not fixed layout templates. One direction retains observed
colours. Compare the planned silhouettes and change any that depend on palette swaps to differ.

## Author for the actual business

Choose image scale, type, spacing and section transitions together. Carry a recognisable motif through
the page where it earns its place. A giant logo in a decorative panel, an oversized category heading,
thin-rule list and phone footer should not become the default across unrelated trades. Pale paper,
serif/mono type and large amounts of empty space are choices that need a reason, not a house style
for every prospect. Do not replace this default with a different shared template.

Use the copy skills to explain confirmed services and make the next inquiry easy. Sparse research
does not justify repeating the category several times as the whole page. Offer useful questions to
discuss without promising unconfirmed services, hours, prices, credentials or outcomes. Avoid invented
portfolio entries, testimonials, ratings and statistics.

## Review appearance and browser behaviour separately

Mark identity assets `data-asa-image="logo"` and substantive images `data-asa-image="content"`.
For a deliberate inline SVG illustration or CSS image background, mark its painted element as content.
Never relabel a logo or empty shape to satisfy the check.

Run ASA preview with `--require-content-image` into `review/`. All four viewports must pass. Examine
the imagery evidence in `findings.json` as well as desktop/mobile openings and full-page screenshots.
Test useful interactions and keyboard access. The report confirms minimum image presence and
mechanical behaviour; it cannot judge image relevance or originality.

Have a different available worker review finished pages. In `REVIEW.txt`, record concrete observations
for business fit, imagery/crops, typography, composition/section rhythm and mobile. Name any weakness
and the fix made. A clean browser report alone does not pass this review. Compare all three concepts
and at least one different business from the batch; return interchangeable designs to their author.
Do not count a missing-image or visually unfinished concept as complete just to meet the daily target.

Only the coordinator uploads completed drafts. Generated pages, research, images, brand kits and
review artifacts remain outside Git and become durable in private R2. Current verified bundles are
immutable; revisions require the existing versioned review workflow, not overwriting a prior upload.
