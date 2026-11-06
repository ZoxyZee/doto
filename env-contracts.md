# DOTO environment contracts

Expo embeds `EXPO_PUBLIC_*` values in the APK. They are readable by anyone who has
the file. The ignored `.env` is a build input, not a secret vault. See the
[Expo environment variables guide](https://docs.expo.dev/guides/environment-variables/).

| Variable | Contract |
| --- | --- |
| `EXPO_PUBLIC_DOTO_CLOUD_ENABLED` | `false` by default. Only `true` enables cloud access and Android internet permission. |
| `EXPO_PUBLIC_DOTO_API_URL` | Public bare HTTPS origin of the deployed Cloudflare Worker. No credentials, path, query, or fragment. |

[`app.config.js`](app.config.js) rejects public variable names resembling credentials
and rejects invalid Worker URLs in cloud builds. `src/cloud/client.ts` also validates
the URL before creating a client. Offline builds do not create a cloud session or
call the Worker.

`ADMIN_TOKEN` belongs only in Cloudflare Worker secrets. It must never be prefixed
with `EXPO_PUBLIC_`, placed in `.env`, committed, or included in an APK. The admin
website asks for it interactively and keeps it in browser session storage. Mobile
device tokens are issued at runtime by the Worker and stored in Expo SecureStore.
Only token hashes are stored in D1; the Worker scopes every query to the token's user.

For deployment and real-device checks, follow [Cloudflare setup](WORKER_SETUP.md).
Changing the Worker URL or switching between offline/cloud mode requires a new APK.
