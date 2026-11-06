# DOTO cloud setup

The mobile source now supports offline-first account sync. The existing APK in `artifacts/` was built before cloud configuration and remains offline. A Supabase project, the SQL migration, and a newly configured APK are required to use cloud sync.

## Create the hosted project

1. Create a project in the [Supabase Dashboard](https://supabase.com/dashboard). Keep the database password private.
2. In **Authentication → Providers**, keep **Email** enabled. Leave email confirmation enabled; after signing up, confirm the email in a browser and return to DOTO to sign in.
3. Open **SQL Editor**, paste the complete contents of [`supabase/migrations/20261106000000_doto_sync.sql`](supabase/migrations/20261106000000_doto_sync.sql), and run it once. It creates owner-scoped tables and two authenticated RPC functions.
4. In the project **Connect** dialog, copy the **Project URL** and **publishable key**. Do not use or share the `service_role` or `sb_secret_` key in the app.
5. Copy `.env.example` to `.env` and fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. These public values are embedded when the APK is built; a different project needs a new APK. Follow the [environment contracts](env-contracts.md) before building.

The Supabase [React Native Auth guide](https://supabase.com/docs/guides/auth/quickstarts/react-native) covers project and email sign-in setup. The database function and RLS guidance is in the [database functions](https://supabase.com/docs/guides/database/functions) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) docs.

## Check it on devices

1. Build and install a new APK after setting `.env`. The old offline APK has no internet permission.
2. On device A, add a habit while offline, then sign in when online. Settings shows pending changes and the last sync time.
3. Sign in to the same account on device B. Open the app or tap **Sync now** to download the habit.
4. Make changes offline on either device. Reopen the app with internet, or leave it open; it retries automatically while active. **Sync now** bypasses the retry delay.
5. Check an edit conflict and a completion toggle on both devices. A remote deletion wins over a local edit; other explicit local edits retry against the latest server version.

All changes save to SQLite immediately. Uploads are acknowledged with operation IDs, so retrying after a lost response does not duplicate a change. The server gives each account an ordered revision cursor for downloads. Guest habits upload after sign-in. Signing out waits for pending changes, then removes that account's local habits and reminders. Sync runs while the app is active; it does not run after the app is fully closed.

Run `npm run typecheck`, `npm test`, and `npm audit` before building. The tests use embedded PostgreSQL for the SQL migration and an in-memory SQLite adapter for client sync behavior. A real Supabase project and Android device are still needed for end-to-end verification.
