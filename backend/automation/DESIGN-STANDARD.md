# Prospect homepage design standard

Apply this to every homepage concept in the daily routine. The target is a business-specific,
complete visual proposal with meaningful imagery. Thirty mechanically valid pages are not thirty
successful designs. Keep draft approval and publication with staff.

## Resolve the visual direction and media before authoring

Read ASA Page's `references/art-direction.md`. Prepare a shared media kit alongside the business's
logo and facts. Keep each asset's source or generation provenance, reuse status and local filename
in `ASSET-PROVENANCE.json` outside the checkout. Original business assets, public-domain and openly
licensed photos/illustrations, properly licensed stock, and generated conceptual imagery are all
valid sources. ImageGen is optional; select and mix sources by relevance, quality and the direction,
with no required generated-image quota. Existing suitable imagery need not be regenerated.
For sourced assets, record the original asset page, creator, licence identifier/URL, attribution
requirements and any modifications. Verify reuse and adaptation permissions for the intended use;
a publicly accessible image is not automatically openly licensed. Keep required attribution in the
authored page or a bundled credits page as well as internal provenance. Download permitted assets
into the external job's local assets; the prospect sandbox cannot rely on third-party hotlinks.
Use an available image-generation skill/tool when conceptual photography suits a missing subject
or a custom composition. Do not silently
fall back to blank panels or logos when obtaining photographs takes more work. Report a media blocker
if suitable imagery cannot be obtained.

Every concept needs at least one substantial local photograph or purpose-made content illustration
near its opening, at desktop and mobile widths. Logos, brand signatures, icons, gradients and simple
decorative CSS shapes do not count. Visual trades benefit from supporting images with different
subjects or details when these add information. Decide image selection, crop and focal point for
each concept, rather than placing the same picture into the same right-hand rectangle three times.
Illustrative stock, open-collection and generated imagery must not imply the business owns a
pictured shop, employs pictured people,
sells a pictured product or completed a pictured project. Keep that distinction in asset provenance;
do not describe conceptual imagery as an actual business portfolio.

Before fan-out, write `ART-DIRECTION.md` with one paragraph per concept: business cue, visual thesis,
opening composition, type relationship, image role/crop, section rhythm and primary action. Concept
labels describe communication priorities, not fixed layout templates. One direction retains observed
colours. Compare the planned silhouettes and change any that depend on palette swaps to differ.

## Translate the Akili and 6ixSummit lessons into the design

Read ASA Page's `references/design-studies.md`, including its refreshed observations of both live
sites and their pointer states. Treat these as a source of art direction throughout authoring and
review. In `ART-DIRECTION.md`, describe the chosen material/texture, focal hierarchy and depth,
photographic tone, section rhythm and interaction vocabulary, with a business-specific reason.

6ixSummit connects graded city imagery, grain, translucent depth and a pointer reveal into one
digital atmosphere; its reveal protects text readability. Akili connects aerial composition, a warm
photographic grade, a technical grid and a surveying-style pointer response into its engineering
subject. Transfer those relationships to this business. The reference's exact colours, grain,
crosshair or lens are possible techniques, not a shared style for every prospect.

| Dimension | Authoring expectation | Reviewer evidence |
| --- | --- | --- |
| Composition | Arrange image, title, action, visual mass, negative space and section transitions as a deliberate hierarchy | A convincing focal point and reading path in the opening and full page, including mobile |
| Texture and material | Give surfaces a relevant material quality through imagery, controlled grain/detail, layering or deliberate smoothness | Texture contributes to the business's atmosphere and remains crisp and readable at the intended scale |
| Colour and grading | Connect surfaces, type and photographic tone; use exposure, white balance, hue, saturation and local scrims deliberately | Images feel related without losing detail; original logos and decision-relevant product/material colours remain faithful |
| Interaction | Develop a relevant behaviour such as image exploration, a masked reveal, material inspection or subtle spatial response when it serves the direction | The live behaviour works, strengthens the subject and preserves text, controls and image visibility |
| Continuity | Develop a motif through several design decisions rather than repeating an icon | Image framing, layout, material, type or behaviour form one recognisable visual world |

Use `$asa-media` for appropriate lens, grading or procedural fragments, or author custom CSS/SVG/
canvas behaviour. A chosen live treatment belongs in the delivered page; a still or an unimplemented
plan does not provide interactivity. A generic link hover alone does not fulfil a direction built
around exploration. Select the treatments that fit the concept rather than adding every effect.
Keep a strong composition for touch, keyboard and reduced-motion use as well as the pointer state.

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
Review sourced and generated assets against the same visual standard. Source type alone neither
earns a pass nor justifies replacing a suitable image; check provenance and required credits too.

The reviewer assesses the art-direction dimensions above in the actual rendered page and records
visible evidence or a specific weakness in `REVIEW.txt`. A note naming texture, colour or interaction
is not proof that the resulting page has those qualities. Inspect whether the material treatment,
photographic tone, typography and hierarchy work together; return an interchangeable design for
revision even when it contains enough images and has zero browser findings.

For chosen pointer/motion treatments, retain normal-motion and active-pointer captures alongside
the default/reduced-motion renders. `preview.sh --motion` captures normal motion; exercise pointer
states in a browser. Test entry, movement over images and nearby headlines/contact controls, exit,
touch, keyboard and reduced motion. Check readability in the actual changed state. Decorative
layers must leave clicks and focus operable; a colour reveal must not wash out copy. Original logos
must stay faithful, and the mobile/static experience must retain the intended character. Record
what was exercised and its result, then recheck fixes before accepting the visual handoff.

### Review whether the whole page has enough imagery

The one-image check is a minimum presence check. It does not establish that the page has enough
imagery for its business, content or composition. Do not treat `openingContentCount >= 1` as a
visual-review pass, and do not replace it with an arbitrary larger image quota.

The reviewer first reads the business brief and inspects the desktop/mobile full-page captures,
forming an independent judgement before reading the author's claim that the design is complete.
In the media section of `REVIEW.txt`, account for each substantial content section. Identify its
customer-facing purpose, the actual image filename(s) and what they contribute, or a specific reason
that section works as text alone. Name any missing visual subject, the section needing it and the
revision required. A contact strip or practical FAQ may work well without another picture; a service,
product or materials section may need imagery that the opening photograph does not provide.

Assess relevance, useful variety, crop, resolution and placement at both desktop and mobile sizes.
Check whether images explain meaningful service/material differences or support a customer's
decision. Repeated crops of one photo are treatments of one source, not evidence of different work
or subjects. Decorative filler, duplicate images and unrelated stock do not remedy a missing subject.
Extra images need a purpose too. Preserve the distinction between conceptual imagery and actual
business work; an unsourced portfolio is a defect even when it makes the page look richer.

Finish the media review with `pass`, `revise` or `blocked` and reasons tied to the captures. A single
image may pass when it supports the particular design and the other sections have convincing
text-only treatment. "The minimum passed", "looks good" or "more images are unnecessary" alone are
insufficient reasons. Return the page for revision if useful imagery is missing, including when
all browser findings pass. If a necessary asset cannot be obtained truthfully, mark the media review
blocked and report that shortfall instead of counting the concept as complete.

The coordinator checks this section-level review against the actual captures and asset provenance
before accepting handoff. After fixes, the reviewer rechecks the affected sections and mobile layout;
the author's promise to add images is not a completed revision. This remains an agent's visual
assessment for draft handoff, not staff approval or permission to publish.

Have a different available worker review finished pages. In `REVIEW.txt`, record concrete observations
for business fit, imagery/crops, typography, composition/section rhythm and mobile. Name any weakness
and the fix made. A clean browser report alone does not pass this review. Compare all three concepts
and at least one different business from the batch; return interchangeable designs to their author.
Do not count a missing-image or visually unfinished concept as complete just to meet the daily target.

Only the coordinator uploads completed drafts. Generated pages, research, images, brand kits and
review artifacts remain outside Git and become durable in private R2. Current verified bundles are
immutable; revisions require the existing versioned review workflow, not overwriting a prior upload.
