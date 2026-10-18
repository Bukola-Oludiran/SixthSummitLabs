# One domain, three routes

The site is not hosted yet. Local development implements the intended routing:

| Route on the main website | Application |
| --- | --- |
| `/` | 6ixSummit marketing site |
| `/crm`, `/crm/leads/ID`, `/crm/follow-ups`, `/crm/designs`, `/crm/analytics` | Authenticated React staff workspace |
| `/crm/api/...`, `/crm/admin/...` | NocoBase APIs and retained administration |
| `/prospect-api/staff/...` | Authenticated private review captures |
| `/designs/<opaque-token>` | Unlisted prospect gallery |
| `/prospect-api/designs/<opaque-token>/...` | Read-only gallery metadata and approved files |

Run the website with `npm run dev` from the repository root. Run `npm run crm:dev` and `npm run prospects:dev` from `backend`, alongside PostgreSQL. Use **http://127.0.0.1:5173** consistently so browser sessions and stored gallery links share the same origin.

NocoBase's environment has `APP_PUBLIC_PATH=/crm/`, with **unprefixed** `API_BASE_PATH=/api/`, `WS_PATH=/ws` and `PLUGIN_STATICS_PATH=/static/plugins/`. Its launcher prefixes those three values automatically; do not write `/crm/api/` into the base setting. Workers use `NOCOBASE_URL=http://127.0.0.1:13000/crm`. Vite serves the known staff workspace routes from the React SPA and forwards the other `/crm/...` paths, including API, admin, plugin assets and WebSocket traffic, to NocoBase. It forwards `/prospect-api` to the prospect service. Do not reinstate the old broad `/crm` proxy or redirect `/crm` to NocoBase: those would hide the new frontend. Staff routes receive no-store/noindex headers. Server credentials are never included in the Vite bundle.

`nginx.conf.example` is a future deployment routing template, not an active deployment. Adapt the static root and hostname to the chosen server. Provision HTTPS at that server or its edge before sharing real links. Build the marketing site with `npm run build`; use a production NocoBase build/start rather than its development server, and keep the prospect service running with a process supervisor. Retain the database across deploys. Configure the private S3-compatible design bucket as described in [object storage](../backend/OBJECT-STORAGE.md); generated pages, previews and editable masters persist there. Do not use the checkout or a deployment filesystem as their durable store. Temporary authoring takes place outside the checkout. Existing local demo files require the documented one-time migration after a bucket is selected. Only the marketing `dist` directory is a public static root: never expose the repository, `.env` or all of backend storage.

Once a hostname exists, set `PUBLIC_SITE_URL=https://YOUR_DOMAIN` in `backend/.env` and run `npm run designs:publish`. The sync updates stored lead/concept URLs while retaining each token. Restart the prospect service after changing its environment. No DNS, hosting or certificate changes have been made by this implementation.

Staff private previews send the caller’s Bearer token and role to the prospect service, which checks the current lead permission through NocoBase before retrieving a capture from S3. Both services must be running. There is no public-bucket redirect or root-session fallback for these requests. With S3 unconfigured, design states remain visible but private image previews remain unavailable.
