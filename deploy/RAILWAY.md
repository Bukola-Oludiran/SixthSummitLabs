# Railway backend

Use one Railway service for NocoBase, CRM APIs, prospect delivery and publication.
The Cloudflare frontend and private R2 bucket remain separate from this service.

## Service settings

| Setting | Value |
| --- | --- |
| Root Directory | `/backend` |
| Builder | Dockerfile (detected from `backend/Dockerfile`) |
| Build Command | Leave unset; Dockerfile supplies the build |
| Start Command | Leave unset; Dockerfile starts `node scripts/start.mjs` |
| Pre-Deploy Command | `npm run deploy:prepare` |
| Pre-Deploy Timeout | `300` seconds |
| Healthcheck Path | `/health` |
| Replicas | `1` |
| Volume mount | `/app/storage` |

The Dockerfile downloads the exact NocoBase revision in `backend/nocobase-revision`,
installs its locked dependencies including build tooling, builds the application
and custom plugin, and installs the separate object-storage package with `npm ci`.
The image build uses npm's official registry in place of the upstream download
mirror, retaining the pinned versions and integrity checks. It works even when
Railway has not initialized the Git submodule. Keep the revision
file in sync with the `backend/nocobase` Git link when updating NocoBase.

Do not rely on an ordinary `npm install` from `/backend`: the S3 SDK belongs to
`services/object-storage`, and NocoBase has its own Yarn workspace. Neither is
installed by that command. A build-time import check rejects missing dependencies
and missing compiled client/server assets before an image can be deployed.

## Runtime variables

Set these in the Railway service's Variables tab, keeping credentials out of Git:

```dotenv
APP_KEY=<stable randomly generated secret>
INIT_ROOT_EMAIL=<administrator email>
INIT_ROOT_USERNAME=<administrator username>
INIT_ROOT_PASSWORD=<strong administrator password>
PUBLIC_SITE_URL=https://6ixsummitlabs.com
CORS_ORIGIN_WHITELIST=https://6ixsummitlabs.com
DB_DIALECT=postgres
DB_HOST=<Neon direct connection hostname>
DB_PORT=5432
DB_DATABASE=<database name>
DB_USER=<database user>
DB_PASSWORD=<database password>
DB_DIALECT_OPTIONS_SSL_MODE=require
DB_DIALECT_OPTIONS_SSL_REJECT_UNAUTHORIZED=true
```

The image sets production mode, `APP_HOST=0.0.0.0`, `/crm/` routing, and
`STORAGE_PATH=/app/storage/nocobase`. Railway supplies `PORT`. Do not override
these with localhost settings copied from the development environment. Supplying
only `DATABASE_URL` is insufficient: this pinned NocoBase configuration reads the
individual `DB_*` variables above. Use the direct Neon endpoint for preparation.

`CORS_ORIGIN_WHITELIST` explicitly trusts the public website for NocoBase sign-in
and cookie authentication through Cloudflare and Railway. The hosted proxy chain
can present the Railway hostname to NocoBase even when the browser uses the
website domain. `PUBLIC_SITE_URL` controls gallery links; it does not configure
NocoBase's sign-in origin allowlist. Keep the allowlist limited to the exact
frontend origin, without `/crm` or a trailing slash. Redeploy after changing it.
Leave `API_BASE_URL` unset so browser API calls continue through `/crm/api/` on
the website origin.

For R2, set `DESIGN_S3_BUCKET`, `DESIGN_S3_REGION=auto`,
`DESIGN_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`,
`DESIGN_S3_ACCESS_KEY_ID`, `DESIGN_S3_SECRET_ACCESS_KEY` and optionally
`DESIGN_S3_PREFIX`. See [object storage](../backend/OBJECT-STORAGE.md). The bucket
stays private. Without a bucket the CRM can run, but design files cannot publish.

## Database preparation and deployment

The explicit `deploy:prepare` pre-deploy command installs NocoBase only if the
database is uninitialized, enables the CRM plugin if needed, and runs the existing
additive collection/view bootstrap over a temporary loopback listener. It never
uses database reset or force-install flags. It requires the configured root
credentials; on subsequent deployments these must still authenticate against the
existing administrator account. It exits before the normal service starts.
No publication worker runs during preparation. Railway pre-deploy containers do
not have the service volume mounted; preparation changes the database, not volume
files required by the running service.

Normal startup uses one Node process. `/health` checks the running application and
CRM database. The runtime volume holds NocoBase operational files and the local
publication lock; generated designs remain in R2. Neon needs its own backups.

After pushing, check that Railway logs show `Using detected Dockerfile!`, that
pre-deploy preparation completes, and that `/health` returns `200`. The
[Cloudflare Worker](CLOUDFLARE.md) supplies same-origin routing for `/crm/api/`,
`/crm/admin/`, `/crm/ws` and `/prospect-api/`; deploy the frontend Worker as well
as the backend when first enabling that routing.

## Startup troubleshooting

If the sign-in form returns **Invalid sign-in origin**, set
`CORS_ORIGIN_WHITELIST=https://6ixsummitlabs.com` in Railway and redeploy, then
sign in from `https://6ixsummitlabs.com/crm` or its native administration page.
The rejection happens before credential validation; changing the administrator
password does not fix this origin configuration. Keep the origin check enabled.

If startup fails, the launcher logs a safe stage, error code and configuration
hint. `CRM_PLUGIN_DISABLED` or `APP_NOT_INSTALLED_ERROR` means the pre-deploy
preparation step is missing or did not complete. The `About to overwrite
ArrayBuffer.prototype properties` notice also occurs during successful NocoBase
startup; it does not by itself identify a failure. Check the structured startup
error and the pre-deploy logs. Raw connection strings, SQL and credentials are
not included in the diagnostic.

## Local image verification

```sh
docker build -t sixsummit-backend:local backend
docker run --rm sixsummit-backend:local node scripts/check-production.mjs
```

Builds use public upstream source and need no application secrets or database.
The Docker context explicitly excludes `.env`, dependency folders, runtime state,
the developer's NocoBase checkout and generated output.
