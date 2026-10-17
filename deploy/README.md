# One domain, three routes

The site is not hosted yet. Local development implements the intended routing:

| Route on the main website | Application |
| --- | --- |
| `/` | 6ixSummit marketing site |
| `/crm` | Authenticated NocoBase CRM |
| `/designs/<opaque-token>` | Unlisted prospect gallery |
| `/prospect-api/designs/<opaque-token>/...` | Read-only gallery metadata and approved files |

Run the website with `npm run dev` from the repository root. Run `npm run crm:dev` and `npm run prospects:dev` from `backend`, alongside PostgreSQL. Use **http://127.0.0.1:5173** consistently so browser sessions and stored gallery links share the same origin.

NocoBase's environment has `APP_PUBLIC_PATH=/crm/`, with **unprefixed** `API_BASE_PATH=/api/`, `WS_PATH=/ws` and `PLUGIN_STATICS_PATH=/static/plugins/`. Its launcher prefixes those three values automatically; do not write `/crm/api/` into the base setting. Workers use `NOCOBASE_URL=http://127.0.0.1:13000/crm`. Vite forwards `/crm` and `/prospect-api`; no CRM credential is put into the Vite bundle.

`nginx.conf.example` is a future deployment routing template, not an active deployment. Adapt the static root and hostname to the chosen server. Provision HTTPS at that server or its edge before sharing real links. Build the marketing site with `npm run build`; use a production NocoBase build/start rather than its development server, and keep the prospect service running with a process supervisor. Retain `backend/storage` and the database across deploys. Only the marketing `dist` directory is a public static root: never expose the repository, `.env` or all of backend storage.

Once a hostname exists, set `PUBLIC_SITE_URL=https://YOUR_DOMAIN` in `backend/.env` and run `npm run designs:publish`. The sync updates stored lead/concept URLs while retaining each token. Restart the prospect service after changing its environment. No DNS, hosting or certificate changes have been made by this implementation.
