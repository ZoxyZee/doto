# DOTO environment contracts

This contract defines what may enter a DOTO mobile build. Expo replaces `EXPO_PUBLIC_*` references in the JavaScript bundle at build time, so anyone with the APK can read those values. The `.env` file is ignored by Git, but that does **not** make its public-prefixed values secret. See the [Expo environment variable guide](https://docs.expo.dev/guides/environment-variables/) and [Supabase API key guide](https://supabase.com/docs/guides/getting-started/api-keys).

| Variable | Where used | Contract |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile build | Public HTTPS project origin only, such as `https://project-ref.supabase.co`. No credentials, path, query, or fragment. |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Mobile build | Public `sb_publishable_...` key for that same project. It identifies the app, not the user. Supabase Auth and database RLS still enforce user access. |

Both variables must be present together for a cloud build. With neither set, DOTO runs in offline guest mode. [`app.config.js`](app.config.js) rejects a partial pair, placeholders, malformed URLs, secret-key formats, and public variable names that look like credentials. Check the resolved config with `npx expo config --type public` before building.

## Never place these in the mobile build

- Supabase `sb_secret_...` or legacy `service_role` key.
- Database password, Postgres connection string, JWT signing secret, SMTP password, or other server credentials.
- A user's access token or refresh token in `.env`, source, logs, or build configuration.

Account tokens come from Supabase Auth at runtime and are stored in Expo SecureStore. The mobile client never uses a server key. Direct table writes are revoked; the [SQL migration](supabase/migrations/20261106000000_doto_sync.sql) limits sync RPC calls to signed-in users and checks ownership on the server.

## Local files and deployment

- Copy `.env.example` to `.env`, fill only the two public variables, and keep `.env*` files out of Git. The example file remains tracked.
- Use separate Supabase projects and values for development and production. Check which values Expo selected before each APK build. SDK 58 uses `.env.production.local`, `.env.local`, `.env.production`, then `.env` for production builds; do not rely on a custom `.env.staging` filename.
- A new project URL or publishable key requires a new APK. The currently distributed APK was built without cloud values and remains offline.
- If a publishable key is rotated, update the build environment and rebuild the app. If a server secret leaks, revoke it in Supabase immediately; changing the APK cannot secure a leaked server secret.

Before distributing a cloud APK: run `npx expo config --type public`, `npm run typecheck`, `npm test`, and `npm audit`; apply the SQL migration; then test sign-in, offline edits, reconnect, cross-device download, and account isolation on real devices.
