# Cloudflare frontend and Railway proxy

The `sixthsummitlabs` Worker serves the Vite build and forwards server requests
to `https://sixthsummitlabs-production.up.railway.app`. Its public domain is
`https://6ixsummitlabs.com`. Keep the existing domain attachment in the Worker's
**Settings → Domains & Routes**; this configuration leaves domain management
in the dashboard.

## Workers Builds settings

| Setting | Value |
| --- | --- |
| Repository | `Bukola-Oludiran/SixthSummitLabs` |
| Production branch | `main` |
| Root directory | Repository root (not `/backend`) |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` (or `npx wrangler deploy`) |

Deploy the Worker script using the root `wrangler.json`. A static-assets-only
deploy command such as `wrangler deploy --assets dist` is not the intended
configuration. `BACKEND_ORIGIN` is a nonsecret Worker binding already declared
in that file. No `VITE_*` backend URL, database credentials or R2 keys belong in
the frontend. Keep backend and object-storage credentials on Railway.

In Railway set **`PUBLIC_SITE_URL=https://6ixsummitlabs.com`** and
**`CORS_ORIGIN_WHITELIST=https://6ixsummitlabs.com`**, then redeploy. The first
controls generated gallery links; the second lets NocoBase accept the public
website's sign-in origin through the hosted proxy chain. Leave `API_BASE_URL`
unset so the browser uses the website's same-origin proxy. Keep `APP_PUBLIC_PATH=/crm/`,
`API_BASE_PATH=/api/`, `WS_PATH=/ws` and
`PLUGIN_STATICS_PATH=/static/plugins/`; NocoBase applies the `/crm` prefix.
The backend launcher renders NocoBase's admin HTML with these runtime paths.
Existing gallery records can be updated by running `npm run designs:publish`
from `/app` in a Railway service shell after setting the public URL.

## Routing and privacy

The Worker runs before static SPA fallback on `/crm`, `/designs`,
`/prospect-api` and their child paths. The React staff pages stay on Cloudflare;
native CRM API, admin, plugin, asset and WebSocket paths go to Railway.
Prospect metadata, captures and design files also go to Railway, where the
existing authentication, publication checks and private R2 access apply.
The legacy `/global.css` and `/browser-checker.js` references redirect to
their `/crm/` equivalents.

The proxy streams bodies and files, forwards the caller's credentials and role,
keeps WebSocket upgrades intact, and replaces forwarded host/protocol headers.
It does not follow upstream redirects with credentials. Redirects back to
Railway are rewritten to the requesting frontend origin. CRM and prospect
responses use no-store/noindex/no-referrer headers; upstream CSP is retained.
An unreachable backend returns a generic JSON `502`, never the marketing page.
Ordinary marketing assets still use Cloudflare's static asset delivery.

## Verification

Run `npm test`, `npm run build` and `npm run cloudflare:dev` locally. The latter
uses the configured live backend, so only perform read-only checks with it.
It disables automatic loading of the repository's `.env` into Worker bindings.

After Workers Builds completes, verify:

- `https://6ixsummitlabs.com/crm` shows the staff sign-in page.
- `https://6ixsummitlabs.com/crm/api/app:getInfo` returns NocoBase JSON.
- `https://6ixsummitlabs.com/crm/api/auth:check` returns JSON `401` without a session.
- `https://6ixsummitlabs.com/prospect-api/designs/invalid` returns JSON `404`.
- `https://sixthsummitlabs-production.up.railway.app/health` returns `{"ok":true}`.

The proxy does not create an administrator account; use the account configured
on the Railway backend. Real prospect galleries require published designs in R2.
