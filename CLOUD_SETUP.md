# DOTO cloud setup

DOTO now uses **Cloudflare Workers + D1**, with SQLite on the phone for offline use.
Supabase is not part of the app or backend. Follow [Cloudflare setup](WORKER_SETUP.md)
for database creation, Worker deployment, admin access, and a new Android build.
The existing APK in `artifacts/` remains offline and predates the name screen.
