# DOTO on Cloudflare Workers and D1

Supabase is no longer used. The Worker handles private device sessions, sync, and the
admin API; D1 stores the data; the same Worker serves the admin website. The app keeps
SQLite as its offline-first local store. The Worker and D1 are now deployed at
`https://doto-api.doto-197796f7.workers.dev/` on Cloudflare's Free-compatible services.

## 1. Authenticate and create D1

From this repository root, sign in to your own Cloudflare account:

```powershell
node node_modules/wrangler/wrangler-dist/cli.js login --device
node node_modules/wrangler/wrangler-dist/cli.js d1 create doto-data --location apac
```

This project already has the D1 database ID in
[`worker/wrangler.jsonc`](worker/wrangler.jsonc). Only repeat database creation for a
new environment, then replace the ID in that configuration. Apply the schema to a
new remote database **once**:

```powershell
node node_modules/wrangler/wrangler-dist/cli.js d1 migrations apply DB --remote --config worker/wrangler.jsonc
```

Cloudflare [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
track applied files, so later migrations can be applied without repeating the first.
Never point a test build at the production D1 database.

## 2. Configure private admin access and deploy

The deployed Worker has a random 32-byte `ADMIN_TOKEN` stored as a Cloudflare secret.
A local copy for the owner's admin login is in ignored
`.build-tools/cloudflare/admin-secrets.json`. Move it to a password manager and keep
it private. For a new deployment or rotation, set a fresh token with Wrangler:

```powershell
node node_modules/wrangler/wrangler-dist/cli.js secret put ADMIN_TOKEN --config worker/wrangler.jsonc
npm run worker:deploy
```

Open `https://doto-api.doto-197796f7.workers.dev/` in a browser and enter the
private admin token. The website is publicly reachable, but metrics require that
token. Keep it out of Git, screenshots, APKs, and chat. If it leaks, rotate the Worker
secret. `ADMIN_TOKEN` is also used to hash registration IP addresses for a daily
rate limit; raw IP addresses are not stored in D1.

For local testing, copy `worker/.dev.vars.example` to `worker/.dev.vars` and replace
the placeholder with a local-only test token. `.dev.vars` is ignored by Git. Run
`npm run worker:dev` after applying the migration with `--local`.

## 3. Make a cloud-enabled Android APK

After deployment, create an ignored `.env` from `.env.example`:

```env
EXPO_PUBLIC_DOTO_CLOUD_ENABLED=true
EXPO_PUBLIC_DOTO_API_URL=https://doto-api.doto-197796f7.workers.dev/
```

The current `artifacts/DOTO-cloud-0.1.9.apk` was built with these values. For later
app changes, build a new APK. Cloud-enabled builds allow internet permission; offline
builds block it.
The app asks for a name first. When online, it creates a private device token, keeps
that token in Android SecureStore, and syncs pending SQLite changes. No email or
Supabase account is required.

For unfamiliar habit names, the app offers a user-triggered AI tip. The Worker uses its
Workers AI binding; no AI API key is embedded in the APK or repository. Only the habit
name is sent for this request, and the generated tip is cached in local SQLite. The
Worker caps requests at 8 per device account and 100 total per UTC day. It uses a
Workers Free model; the app keeps showing its built-in tip when AI is unavailable. This feature
generates a short suggestion; it does not search Google or verify live sources.

**Recovery limit:** The device token is currently the only proof of ownership.
Uninstalling, clearing app data, or moving phones loses access to the cloud account.
Local habits also disappear on uninstall. Do not present this preview as a recoverable
backup; add account recovery before a wider release.

## 4. Verify before sharing

Run `npm run typecheck`, `npm test`, `npm run admin:build`, and `npm audit`. On two
phones with separate installations, check that each sees only its own habits. Add a
habit offline, reconnect, and check the dashboard and sync status. The admin chart
counts days on which an online sync succeeded, not every app launch. A name alone is
not an identity proof. The admin dashboard never shows habit names or descriptions.

Pushing to GitHub does not deploy the Worker or update installed APKs. Deploy Worker
changes with `npm run worker:deploy`; app code updates require a new APK or a separately
configured Expo EAS Update channel.
