# Codex daily lead routine

The requested schedule is **8:00 AM daily, America/Edmonton**. The versioned
[schedule specification](schedule.json) and [run prompt](DAILY-LEADS.md) are ready
for a local Codex scheduled task. These files do **not** register or activate a
schedule. There is no scheduled-task management tool available in this session;
use the desktop app's Scheduled/Automations screen to create the actual task
after credentials and a manual pilot pass. Choose this repository in local mode,
paste the prompt (or instruct it to read `backend/automation/DAILY-LEADS.md`), and
set the time zone explicitly. Use one active instance of this routine.

Local mode is needed for the installed ASA and VectorCraft tools and the private
environment profile. Keep the computer awake and the desktop app running when
the task needs these local files. Default model/reasoning settings are sufficient
to configure the task; validate the chosen model with a manual pilot first.
Official setup guidance: [scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app).

## Private credentials

Copy `environment.example` to `backend/.env.automation`, retaining mode `0600`.
A blank private copy is prepared during setup. Fill it locally, never in chat:

- `NOCOBASE_API_KEY`: a live NocoBase API credential for a dedicated automation
  user with read/write access to `six_leads`, `six_concepts`, `six_sources`,
  `six_runs` and `six_brand_assets`. `six_activities` is not needed for generation.
  A caller-only credential is insufficient. Keep human sales/review actions out
  of the routine even if the credential can access them.
- The R2 bucket, region, endpoint, prefix and object read/write credentials,
  matching Railway's configuration. Prefer a separate R2 token scoped to the
  design bucket. The worker uploads directly to private R2 through the existing
  S3 integration; Railway does not export its environment to Codex.

Do not copy `DB_*`, `DATABASE_URL`, `APP_KEY`, root passwords or `GIT_TOKEN`.
The wrapper requires a live API token and pins the public origins to
`https://6ixsummitlabs.com`. It cannot silently fall back to root sign-in or the
local CRM. `SIXSUMMIT_ENV_FILE=/absolute/path/to/private-file` selects a different
private profile explicitly. Avoid putting secrets in command arguments.

## Verify before activation

From `backend`, with Node 22:

```sh
npm run storage:dependencies
npm run automation -- check
npm run automation -- check --online
npm run automation -- status
```

`check` validates the profile and installed authoring prerequisites without
connecting to services. `check --online` additionally reads one ID from each
required CRM collection; it makes no business-record changes. Neither command
claims to verify API write permissions or successful R2 uploads. Verify the
configured bucket's signed PUT/HEAD/GET round trip separately:

```sh
SIXSUMMIT_ENV_FILE="$PWD/.env.automation" npm run storage:check
```

This leaves one tiny private object under `checks/`; it creates no lead. Verify
the selected account's write permissions in NocoBase and run the prompt manually
on one real, researched business through a verified upload and human review.
Count that business toward the day's ten. Do not import test fixtures into the
production CRM or mark concepts approved just to validate scheduling.

The routine itself uses Codex web search; `SEARXNG_URL` and `ASA_AUTHOR_COMMAND`
are unnecessary. `automation prepare CONCEPT_ID` prepares the external job folder
for Codex to author directly. Upload with `automation upload CONCEPT_ID JOB_FOLDER`.
Additional wrappers provide `discover`, `import`, `asset`, `restore`, `designs`
and `publish`; normal daily runs leave approval/publication to the deployed
backend and staff. Run `automation status` to resume from CRM records.

The daily qualification cap survives restarts and includes all cities combined.
The shared worker lock prevents overlapping CLI commands on this computer; it is
not a distributed lock across machines. Generated work stays outside the codebase
and becomes durable only after a verified R2 upload.
