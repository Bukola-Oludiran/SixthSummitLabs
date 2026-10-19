# 6ixSummit lead studio

Local NocoBase CRM and workers for researching small businesses, preparing private homepage concepts, and tracking human sales calls. The pilot targets **10 qualified leads total per Edmonton calendar day**, across Regina, Edmonton and Calgary, with three concepts per lead. Settings live in `config/pilot.json`.

## Current delivery

- NocoBase source pinned to **v2.2.27**, PostgreSQL, six business collections and a native CRM plugin owned by this repository.
- Call workspace, caller ownership, 12 dispositions, dated follow-ups, meetings, proposals, won/lost projects and permanent opt-outs.
- Transactional, append-only activity history. Duplicate request IDs replay safely; conflicting retries fail. Callers can claim unassigned businesses; administrators can reassign and audit reopening of closed leads. Opt-outs cannot be reopened by that action.
- Analytics for call attempts, connections, distinct meeting bookings, distinct won projects, CAD project value, overdue follow-ups and meeting-cohort conversion. Filters cover date, city and caller.
- OpenStreetMap discovery, evidence-based qualification, deduplication, restart-safe daily allowance and three versioned design jobs per qualified business.
- Freeform ASA handoff, original-logo copying, observed-palette requirements, browser checks and an explicit human visual-review state.
- Custom React staff workspace at `/crm`, with business records, research, protected call actions, notes, design review and analytics. NocoBase administration remains at `/crm/admin/sixsummit`.
- Same-origin prospect galleries at `/designs/<token>`, automatic CRM links, and S3-backed delivery with authenticated staff review captures.
- A single Node backend process and HTTP listener for NocoBase, CRM APIs, prospect routes, WebSockets and the publication timer. `npm start` runs compiled production code; `npm run dev` runs the source server without UI bundlers or a watcher.

**Codex routine:** [setup and commands](automation/README.md), [daily prompt](automation/DAILY-LEADS.md), and [schedule specification](automation/schedule.json). The requested cadence is 08:00 daily in America/Edmonton. Local credentials, a manual live pilot and actual task registration are still pending; the JSON file does not activate a schedule. Codex can research with its own web search and author directly using the installed skills, so a separate SearXNG endpoint and ASA author runner are optional for this routine. The website and backend are deployed through [Cloudflare and Railway](../deploy/README.md); deployment alone does not verify workflow permissions or R2 uploads. Discovery alone does not qualify a business. No automated outreach is enabled. Demonstration records do not count toward real leads or sales metrics.

## Local setup

For Railway, use the [backend deployment guide](../deploy/RAILWAY.md). The Docker
build installs both dependency trees and compiles NocoBase; a default npm install
from this directory does not prepare a production backend.

Requirements: Git, Docker Compose, Node **22**, Yarn Classic, and sufficient disk space for the upstream source dependencies. Use the Node version in `.node-version`; recent unsupported Node versions can break NocoBase dependencies.

```sh
git submodule update --init backend/nocobase
cd backend
npm run setup:env
npm run storage:dependencies
npm run db:up
npm run crm:dependencies
npm run crm:install
npm run crm:plugin:build
npm run crm:plugin:enable
npm run dev
```

In another terminal, from `backend`, run `npm run crm:bootstrap` once the API is available. Bootstrap adds missing fields and managed views without dropping existing collections. The readiness endpoint returns 503 until the CRM collections have been bootstrapped.

Run the marketing site with `npm run dev` from the repository root. The backend’s `npm run dev` serves both API families on port 13000; no separate prospect process is required. For the retained NocoBase administration interface, first build its static client assets with `npm run crm:build -- --no-dts`. The source backend itself uses a TypeScript compiler helper; production uses compiled files. Open **http://127.0.0.1:5173/crm** to sign in on the same origin as the marketing site. Direct NocoBase access is **http://127.0.0.1:13000/crm/admin/sixsummit**. The generated login email and password are in **`backend/.env`**. `setup:env` generates private local credentials without overwriting an existing file, and links the upstream checkout to that environment file. The marketing site's `.env` and Git token are not loaded by these workers.

Existing local installs must add `APP_PUBLIC_PATH=/crm/`, `PUBLIC_SITE_URL=http://127.0.0.1:5173` and set `NOCOBASE_URL=http://127.0.0.1:13000/crm` before restarting NocoBase. Keep `API_BASE_PATH=/api/`, `WS_PATH=/ws` and `PLUGIN_STATICS_PATH=/static/plugins/` unprefixed: NocoBase adds `/crm` automatically. Run bootstrap again to add gallery fields and upgrade the existing managed tables.

PostgreSQL listens on `127.0.0.1:55439`; its data persists in the Docker volume. `npm run db:down` stops the database without deleting data. This is a local development installation; production deployment is a separate task.

Our plugin source is `packages/plugins/@nocobase/plugin-sixsummit-crm`. `crm:plugin:link` copies it into the upstream checkout and links its workspace package; edit the owned source, not the managed runtime copy. Upstream tracked source remains unchanged. The plugin build uses `--no-dts`; the separate `crm:plugin:check` validates TypeScript against the upstream source paths.

## Single-process backend

After dependency installation, CRM installation, plugin enablement and collection bootstrap:

```sh
npm run crm:build -- --no-dts
npm start
```

The production entry point is `scripts/start.mjs`. It boots the pinned NocoBase gateway directly with its `main-only` adapters, retains native API/admin/static/WebSocket handling, and mounts the prospect routes before native static routing. It does not use PM2 or launch another application process. The same process runs the 30-second publication task, prevents overlapping publication runs with the existing worker lock, and drains active publication before closing storage on shutdown. Discovery and ASA authoring remain explicit workflow commands; starting the HTTP backend does not start lead generation or outreach.

The listener uses `PORT`, falling back to `APP_PORT` and then 13000. Set `APP_HOST=0.0.0.0` on Railway; local `.env` files can retain `127.0.0.1`. `GET /health` returns 200 only while the app is started and the CRM database is queryable, otherwise 503. HEAD is supported. Use one backend replica while the publication lock is host-local. Neon TLS, a persistent runtime volume, R2 secrets and `PUBLIC_SITE_URL` still need deployment configuration; this entry point alone does not provision Railway.

## Research and design workers

Run commands from `backend` while NocoBase and PostgreSQL are running:

```sh
npm run leads:discover
npm run leads:verify -- storage/discovery/FILE.json
npm run leads:import -- /path/to/reviewed-candidates.json
npm run designs:run
npm run designs:demo
```

Discovery queries public Overpass sequentially, records HTTPS attribution, and saves observations under private, ignored `storage/discovery`. Shared public endpoints can be unavailable or sparse. A missing website tag means “needs research,” not “has no website.” Website checks require a permitted SearXNG JSON endpoint configured as `SEARXNG_URL`; failed searches, empty results or unresolved business domains keep a lead unqualified. A phone number, target city/province and two distinct, completed website searches within seven days are required. Email is optional. There is no guarantee that open sources can supply the daily target.

Reviewed imports are JSON arrays of observations with `businessName`, `phone`, `city`, `province`, `websiteStatus`, `websiteCheckedAt`, `websiteEvidence.searches`, and `source: {sourceKey, sourceUrl, sourceName}`. Search entries carry `query` and `outcome: "complete"`; provide actual evidence, not invented fixture values. `sourceKey` is stable per source record. Optional fields include email, category, address, social links, observed services, sourced motifs, original logo path and six-digit hexadecimal brand colours. Record motifs as evidence or proposed inspiration explicitly. Establish `logoStatus` as `found` or `not_found` before designs are queued; `found` requires a retrievable original asset in `logoAssetPath`.

The shared worker lock prevents overlapping runs on this host. After a crash, verify the PID in `storage/worker.lock` has exited before deleting that file. Qualification allowances are reconstructed from CRM rows, so restarting does not reset the allowance. This is a single-host pilot, not a distributed job scheduler.

Each concept has a stable `jobKey` of `leadId:briefVersion:conceptNumber`. Briefs and authoring instructions are prepared in an external temporary working folder, never under the codebase. Generated pages, screenshots and editable masters are uploaded to a private S3-compatible bucket. CRM stores the bundle manifest and object references. See [storage configuration, upload/restore commands and migration](OBJECT-STORAGE.md). The author reads the approved `asa-page` skill and creates native HTML/CSS/JS plus local assets in `authored/`. All concepts preserve an observed original logo; concept one must use the observed palette. Concepts remain private and must use confirmed business facts.

Without an author, jobs become `awaiting_author`, not failed or ready. A human can author these folders, or an operator can configure **`ASA_AUTHOR_COMMAND` as a JSON array of executable arguments**, for example `["/absolute/path/to/approved-author-runner"]`. The runner receives the authored folder as its working directory and reads `AUTHORING.txt` and the parent brief. It must finish writing `index.html` before exiting. No shell is invoked and database/Git credentials are omitted from its environment. The runner is separately responsible for its model access and credentials. Do not put credentials in command arguments.

Set `ASA_DIR` to the ASA checkout with its installed dependencies, and optionally `CODEX_SKILLS_DIR` to the installed skills directory. The browser helper captures four widths and audits assets, interactions and basic accessibility. Passing technical checks and uploading the complete verified S3 bundle produces **`needs_review`**; a person must inspect the page and approve it before setting it ready. Existing rendered jobs require an explicit versioned rebrief to regenerate. This backend no longer automatically produces V7 template pages.

## Prospect design galleries

Lead imports now store a unique, unlisted **`designShareUrl`** on each CRM lead and a **`previewUrl`** on each concept. The gallery link is available immediately, including when research or authoring is still pending. Prospects see only approved, published designs; unfinished concepts show a preparation message. The call workspace and managed Leads/Homepage concepts tables expose the links.

Administrators can review a concept in the custom workspace’s business record, under **Designs**, and explicitly approve it after inspecting the preview. Approval requires an uploaded S3 bundle and passing browser findings. Returning an approved concept to review hides it from prospects. The retained NocoBase Homepage concepts table remains available for administration. The prospect service syncs every 30 seconds, or run `npm run designs:publish` explicitly. It reads the uploaded bundle from S3, copies the authored site and desktop/mobile captures into an immutable private S3 snapshot, and writes `publicationKey`, `publicationManifest`, `publishedAt` and `previewUrl` back to the concept. Nothing is published from local disk. All three concepts can share one lead gallery. `needs_review`, failed, old-version and unapproved designs are never served. A new brief version is required to replace a published snapshot.

The public endpoint is `/prospect-api/designs/<token>`, with an explicit allowlist of business name, city and design display fields. It does not expose call notes, lead IDs, evidence, author instructions or credentials. Live concept documents run in a sandbox with no access to the CRM's browser storage, no network API access and no form submission. Staff and prospects share the website origin, so this isolation is required. Gallery links are unlisted bearer links, not client accounts: anyone with a link can view it. Disable **Enable prospect design link** on a lead to revoke future metadata and asset requests.

`PUBLIC_SITE_URL` sets the website origin used in CRM links. Use `http://127.0.0.1:5173` locally. Once hosted, change it to the final HTTPS origin, restart the service and run `designs:publish` to refresh stored URLs without changing tokens. See [deployment routing](../deploy/README.md) and the [workflow agent contract](AGENT-WORKFLOW.md). The unified backend serves `/prospect-api/...` and `/crm/...` from the same listener. Staff preview authorization makes a loopback request to the normal CRM API in that same process, preserving token validation and row permissions. Publication uses a restricted internal repository adapter, without signing in as root. The old `prospects:dev` script is retained only for isolated debugging; do not run it alongside the unified backend. Generated files persist in S3 across deployments; temporary authoring folders are disposable after a verified upload. The database requires its own backup.

`designs:demo` prepares three briefs for a fictional business without writing CRM records or consuming lead allowance. The separate, reviewed skill test is in `../design/experiments/asa-v5-prairie-bloom`.

## Sales flow and reporting

For a personal OpenAI dot, see [business-assistant setup](DOT-ASSISTANT.md). `npm run business:brief` reads the live CRM into a dated briefing with follow-ups, meetings, design blockers and sales metrics; `-- --days 30` changes the sales window. It makes no business-record changes. Dot creation, computer access and recurring check-ins must be configured in ChatGPT separately.

Use the custom staff workspace at **http://127.0.0.1:5173/crm**. Its overview, Leads, Follow-ups, Designs and Analytics navigation use the existing backend data. Staff sign in with a `root` or `sixsummit_caller` account; root credentials in the backend environment are for local administration. Callers can read their assigned and unassigned records, and must claim a record before writing notes, outcomes or sharing changes. Records belonging to another caller are rejected by the backend, including direct links. Demonstration records are excluded by default; administrators can show them explicitly. The retained native **Call workspace & analytics** is also available in NocoBase administration. Claim a business, record a call attempt or a sales update, and supply the required follow-up time, meeting time, loss reason or project value. Calls without an answer do not move an advanced opportunity backward. Closed outcomes clear next actions. Add your partner as a NocoBase user with the `sixsummit_caller` role; the root account is for administration.

API actions are authenticated NocoBase resources under `/crm/api/six_crm:ACTION`:

| Action | Method | Purpose |
| --- | --- | --- |
| `worklist`, `dispositions`, `callers` | GET | Calling queue and safe display options |
| `leads` | GET | Paginated `items` plus `total`, `page`, `pageSize`; filters: `search`, `city`, `owner`, `stage`, `queue`, administrator-only `showDemo` |
| `detail` | GET | `leadId`; visible lead, latest 100 activities, current-version concepts and source evidence |
| `note` | POST | `leadId`, stable `requestId`, `notes`; actor attribution and duplicate-safe append-only notes |
| `sharing` | POST | `leadId`, boolean `enabled`; changes future prospect access |
| `reviewDesign` | POST | Administrator-only `leadId`, `conceptId`, `status` (`ready` or `needs_review`), explicit `reviewed: true` for approval |
| `recordOutcome` | POST | `leadId`, unique `requestId`, `kind` (`call` or `stage_update`), `disposition`, optional notes and required outcome details |
| `assign` | POST | Claim with `leadId`; administrators may provide `userId` |
| `reopen` | POST | Administrator-only `leadId` and audit `reason`; excludes opt-outs |
| `summary` | GET | Optional ISO `from`/`to`, `city` and `callerId` |

Send timestamps as ISO strings with time zones. Send won value as integer **CAD cents**. Actor identity is taken from authentication, never a caller ID supplied in an outcome body. Raw resource updates to protected sales fields and historical activity edits are blocked.

Reporting uses a half-open `[from, to)` range. Manual stage updates count milestones but not calls. Meeting/win counts are distinct businesses with those events in the selected period, rather than a same-period conversion ratio. Connection rate is connected call attempts divided by attempts. Cohort conversion measures businesses first booked in the period that have won by now. Calls retain the original caller and city; current follow-ups and cohort owner filters use current ownership. Demo data is excluded. Day breakdowns use Edmonton time; scheduled dates are displayed in the browser's local time zone.

## Verification

```sh
npm test
npm run crm:plugin:check
npm run crm:plugin:test
npm run crm:smoke
npm run crm:frontend:smoke
```

The smoke test requires the running local backend. It creates a temporary restricted caller and a clearly marked demonstration lead, exercises real transactional actions and permission checks, then removes the temporary user. Demonstration lead/history rows remain auditable and excluded from worklists, quota and metrics. Local test logs, credentials, screenshots and dependencies are ignored by Git.

The browser smoke test requires the root frontend and backend dev servers plus Playwright with its Chromium browser. It uses the NocoBase checkout’s Playwright by default; `PLAYWRIGHT_MODULE` can point to another installed Playwright entry file. It runs only against a loopback origin (`FRONTEND_URL` defaults to `http://127.0.0.1:5173`), creates clearly marked demonstration records and a temporary caller, verifies the real UI flow at four widths, confirms real metrics are unchanged, and deletes the temporary user. Screenshots and findings go to the operating system’s temporary directory. Call and note fixture history remains auditable. No business is contacted.
