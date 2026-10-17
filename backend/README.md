# 6ixSummit lead studio

Local NocoBase CRM and workers for researching small businesses, preparing private homepage concepts, and tracking human sales calls. The pilot targets **10 qualified leads total per Edmonton calendar day**, across Regina, Edmonton and Calgary, with three concepts per lead. Settings live in `config/pilot.json`.

## Current delivery

- NocoBase source pinned to **v2.2.27**, PostgreSQL, six business collections and a native CRM plugin owned by this repository.
- Call workspace, caller ownership, 12 dispositions, dated follow-ups, meetings, proposals, won/lost projects and permanent opt-outs.
- Transactional, append-only activity history. Duplicate request IDs replay safely; conflicting retries fail. Callers can claim unassigned businesses; administrators can reassign and audit reopening of closed leads. Opt-outs cannot be reopened by that action.
- Analytics for call attempts, connections, distinct meeting bookings, distinct won projects, CAD project value, overdue follow-ups and meeting-cohort conversion. Filters cover date, city and caller.
- OpenStreetMap discovery, evidence-based qualification, deduplication, restart-safe daily allowance and three versioned design jobs per qualified business.
- Freeform ASA handoff, original-logo copying, observed-palette requirements, browser checks and an explicit human visual-review state.
- Same-origin `/crm` and `/designs/<token>` routes, automatic CRM gallery/concept links, and a read-only prospect service that freezes reviewed designs for sharing.

**Still to configure:** a permitted search endpoint for live website verification and an author runner for unattended ASA generation. Discovery alone does not qualify a business. No daily schedule, automated outreach or live hosting is enabled. The initial live discoveries remain unverified; demonstration records do not count toward real leads or sales metrics.

## Local setup

Requirements: Git, Docker Compose, Node **22**, Yarn Classic, and sufficient disk space for the upstream source dependencies. Use the Node version in `.node-version`; recent unsupported Node versions can break NocoBase dependencies.

```sh
git submodule update --init backend/nocobase
cd backend
npm run setup:env
npm run db:up
npm run crm:dependencies
npm run crm:install
npm run crm:plugin:build
npm run crm:plugin:enable
npm run crm:dev
```

In another terminal, from `backend`, run `npm run crm:bootstrap` once the API is available. Bootstrap adds missing fields and managed views without dropping existing collections. Restart the development process after first enabling the plugin if necessary.

Run the marketing site with `npm run dev` from the repository root and the prospect service with `npm run prospects:dev` from `backend`. Open **http://127.0.0.1:5173/crm** to sign in on the same origin as the marketing site. Direct NocoBase access is **http://127.0.0.1:13000/crm/admin/sixsummit**. The generated login email and password are in **`backend/.env`**. `setup:env` generates private local credentials without overwriting an existing file, and links the upstream checkout to that environment file. The marketing site's `.env` and Git token are not loaded by these workers.

Existing local installs must add `APP_PUBLIC_PATH=/crm/`, `PUBLIC_SITE_URL=http://127.0.0.1:5173`, `PROSPECT_PORT=13010` and set `NOCOBASE_URL=http://127.0.0.1:13000/crm` before restarting NocoBase. Keep `API_BASE_PATH=/api/`, `WS_PATH=/ws` and `PLUGIN_STATICS_PATH=/static/plugins/` unprefixed: NocoBase adds `/crm` automatically. Run bootstrap again to add gallery fields and upgrade the existing managed tables.

PostgreSQL listens on `127.0.0.1:55439`; its data persists in the Docker volume. `npm run db:down` stops the database without deleting data. This is a local development installation; production deployment is a separate task.

Our plugin source is `packages/plugins/@nocobase/plugin-sixsummit-crm`. `crm:plugin:link` copies it into the upstream checkout and links its workspace package; edit the owned source, not the managed runtime copy. Upstream tracked source remains unchanged. The plugin build uses `--no-dts`; the separate `crm:plugin:check` validates TypeScript against the upstream source paths.

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

Each concept has a stable `jobKey` of `leadId:briefVersion:conceptNumber`. Briefs go to `storage/concepts/lead-ID/vN/concept-N/brief.json`, with authoring instructions in `authored/AUTHORING.txt`. The author reads the approved `asa-page` skill and creates native HTML/CSS/JS plus local assets in `authored/`. All concepts preserve an observed original logo; concept one must use the observed palette. Concepts remain private and must use confirmed business facts.

Without an author, jobs become `awaiting_author`, not failed or ready. A human can author these folders, or an operator can configure **`ASA_AUTHOR_COMMAND` as a JSON array of executable arguments**, for example `["/absolute/path/to/approved-author-runner"]`. The runner receives the authored folder as its working directory and reads `AUTHORING.txt` and the parent brief. It must finish writing `index.html` before exiting. No shell is invoked and database/Git credentials are omitted from its environment. The runner is separately responsible for its model access and credentials. Do not put credentials in command arguments.

Set `ASA_DIR` to the ASA checkout with its installed dependencies, and optionally `CODEX_SKILLS_DIR` to the installed skills directory. The browser helper captures four widths and audits assets, interactions and basic accessibility. Passing technical checks produces **`needs_review`**; a person must inspect the page and approve it before setting it ready. Existing rendered jobs require an explicit versioned rebrief to regenerate. This backend no longer automatically produces V7 template pages.

## Prospect design galleries

Lead imports now store a unique, unlisted **`designShareUrl`** on each CRM lead and a **`previewUrl`** on each concept. The gallery link is available immediately, including when research or authoring is still pending. Prospects see only approved, published designs; unfinished concepts show a preparation message. The call workspace and managed Leads/Homepage concepts tables expose the links.

After reviewing a concept, change its status to **`ready`** in the Homepage concepts table. The prospect service syncs every 30 seconds, or run `npm run designs:publish` explicitly. It copies the authored site and desktop/mobile captures into an immutable snapshot and writes `publicationKey`, `publishedAt` and `previewUrl` back to the concept. All three concepts can share one lead gallery. `needs_review`, failed, old-version and unapproved designs are never served. A new brief version is required to replace a published snapshot.

The public endpoint is `/prospect-api/designs/<token>`, with an explicit allowlist of business name, city and design display fields. It does not expose call notes, lead IDs, evidence, author instructions or credentials. Live concept documents run in a sandbox with no access to the CRM's browser storage, no network API access and no form submission. Staff and prospects share the website origin, so this isolation is required. Gallery links are unlisted bearer links, not client accounts: anyone with a link can view it. Disable **Enable prospect design link** on a lead to revoke future metadata and asset requests.

`PUBLIC_SITE_URL` sets the website origin used in CRM links. Use `http://127.0.0.1:5173` locally. Once hosted, change it to the final HTTPS origin, restart the service and run `designs:publish` to refresh stored URLs without changing tokens. See [deployment routing](../deploy/README.md) and the [workflow agent contract](AGENT-WORKFLOW.md). The service binds to loopback on port 13010; only its public routes should be exposed through the website proxy. Publication storage must persist across deployments.

`designs:demo` prepares three briefs for a fictional business without writing CRM records or consuming lead allowance. The separate, reviewed skill test is in `../design/experiments/asa-v5-prairie-bloom`.

## Sales flow and reporting

Use **Call workspace & analytics** in the CRM menu. Claim a business, record a call attempt or a sales update, and supply the required follow-up time, meeting time, loss reason or project value. Calls without an answer do not move an advanced opportunity backward. Closed outcomes clear next actions. Add your partner as a NocoBase user with the `sixsummit_caller` role; the root account is for administration.

API actions are authenticated NocoBase resources under `/crm/api/six_crm:ACTION`:

| Action | Method | Purpose |
| --- | --- | --- |
| `worklist`, `dispositions`, `callers` | GET | Calling queue and safe display options |
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
```

The smoke test requires the running local backend. It creates a temporary restricted caller and a clearly marked demonstration lead, exercises real transactional actions and permission checks, then removes the temporary user. Demonstration lead/history rows remain auditable and excluded from worklists, quota and metrics. Local test logs, credentials, screenshots and dependencies are ignored by Git.
