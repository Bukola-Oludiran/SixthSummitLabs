PRAIRIE BLOOM — STANDALONE HOMEPAGE CONCEPT

Open index.html in a browser, or serve this directory with any static web server.
There is no build step. Edit index.html, style.css and script.js directly.
The parent session also provided a local preview at http://127.0.0.1:5174/.

Direction
An airy florist's journal with large serif headlines, cream paper, forest-green
ink, warm apricot accents and two contrasting botanical images. A proposed
six-petal flower connects the wordmark, photo seal, section breaks and footer.
The page progresses from an everyday emotional invitation to actual services,
a personal arrangement conversation and direct contact information.

Interactions
- Small-screen navigation opens and closes; Escape returns focus to its button.
- Service descriptions use native keyboard-operable details/summary elements.
- Occasion buttons update their pressed state, a live description, and the
  email link's subject. Related service links select the relevant occasion.
- Phone and email links preserve the reserved fixture contact details.
- Section links, a skip link and back-to-top links work without an app router.
- Reduced motion disables smooth anchor scrolling and transitions.

Review evidence
review/findings.json: final ASA preview helper report.
review/wide-full-page.png: 1440px desktop.
review/narrow-full-page.png: 390px mobile.
review/compact-full-page.png: 320px mobile.
review/medium-full-page.png: 768px tablet.
review/interaction-results.json: browser interaction assertions.
review/menu-open.png: open mobile navigation.
review/occasion-selected.png: selected personal-arrangement state.
review/intermediate-600.png: additional intermediate-width capture.
review-interactions.mjs: editable interaction check script (uses this machine's
installed Playwright; runtime use of the homepage does not need it).
ASSET-SOURCES.txt: asset provenance, proposed identity and business facts.

Limits
This is a FICTIONAL demonstration business, with reserved phone and invalid
email details. Contact links are structurally operable but do not reach a real
florist. No messages were sent, no order was placed, and nothing was published.
Photography illustrates the aesthetic; it does not advertise exact stock or
represent the fictional florist's portfolio. The visible footer states this.
Mechanical checks and manual visual review are not a complete accessibility
audit. No real business details should be inferred beyond the supplied fixture.
