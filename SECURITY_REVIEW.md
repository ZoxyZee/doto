# DOTO preview security review — 6 November 2026

The original review was performed on 1 November 2026. The ARM64 cloud APK was built on 6 November. Its package, permissions, alignment, and signing were checked. It is a preview build, not a public release assessment. No Android device was connected for runtime testing.

## Checks and changes

- Scanned source and configuration for hardcoded credentials. The cloud APK contains the public Worker URL; the private admin token was not found in Git-tracked or addable files.
- Confirmed habit and completion SQL writes use bound parameters and exclusive transactions; the related outbox record is written in the same transaction.
- Disabled Android Auto Backup for the local SQLite database. This improves privacy but means local habits will not restore automatically after a device reset or transfer.
- The cloud APK permits Android internet access. Network state, legacy external storage, system overlay, and FCM receive permissions remain blocked. Local reminders retain notification, boot, wake lock, and vibration permissions. Expo Notifications still contributes launcher badge permissions.
- Removed the unused external `doto://` link handler. The app's launcher activity remains exported as Android requires; other app components are either not exported or protected by a platform permission.
- Upgraded to Expo SDK 58 and React Native 0.88.1, including patched Expo Router 58.0.29. Added Expo Router's required `expo-linking` peer. Upgraded Vitest to 5.0.5 to remove critical test-tool advisories. `npm run typecheck` and all six repository tests pass. The Android release build passed for arm64, 32-bit ARM, x86, and x86-64.
- Re-signed the APK with a unique 3072-bit RSA preview key. APK Signature Scheme v2 and v3 verification passed. The key and passwords are stored only under the ignored local `.build-tools/signing/` directory; back them up securely before using this identity for future updates.

## Remaining risks and limits

- The original full `npm audit` reported **12 moderate advisories, 0 high, and 0 critical**. After removing Supabase dependencies, a fresh audit reported **0 vulnerabilities**. Re-audit before public release.
- Habit data remains plaintext within Android's app-private SQLite storage. There is no app PIN or database encryption. Anyone with access to an unlocked or compromised device may be able to access it.
- No physical-device install, reminder, or behavior test was possible here. The permission reduction and signing were verified from the built APK.
- The new preview certificate differs from earlier debug-signed APKs. Android will not install it as an in-place update over those builds; uninstalling the older app erases its local database.
- This preview key is not a Play Store upload key. Before a public release, use managed release credentials, re-audit dependencies, and test on a real Android device.

## Cloud source added after the APK build

- The default offline Android build blocks internet permission. A separate cloud-enabled build permits internet access and embeds only the public Worker URL. The [environment contract](env-contracts.md) rejects public secret names and invalid endpoints; `.env*` files are ignored by Git.
- The Worker issues random per-installation device tokens. The phone stores its token in Expo SecureStore; D1 stores only its SHA-256 hash. Every sync query uses the user ID looked up from that token. The client-supplied owner ID is overwritten by the Worker.
- D1 applies each entity update, change-log entry, and idempotency receipt in one atomic batch. Local SQLite sync and Worker tests cover account isolation, retries, conflicts, and admin access.
- The registration endpoint limits an IP to 20 new accounts per UTC day. It stores a salted hash of the IP, not the raw address. This is preview abuse protection, not a substitute for Cloudflare rate limiting before a public launch.
- No account recovery exists yet. Losing app data or changing phones loses the device token and access to its cloud account. The Worker and D1 have been deployed and a live cross-account test passed; a physical-device test remains required.

## Artifact identity

- Package: `com.doto.habits`, version `0.1.2`, version code `3`, ARM64
- APK SHA-256: `B74D2C7CFBDDA195307A87729A8E017B81B9C65C8335EF536FB2AD90EF9DC320`
- Signing certificate SHA-256: `f1fd96bfd63c0bc5168157cc12063b9880a73e4d4427a5c1e92b600277d348c6`

## Cloudflare Worker and admin

- Admin metrics require a separate 32+ character `ADMIN_TOKEN` set only as a Worker secret. The admin website keeps it in browser session storage; the Worker compares token hashes before querying D1. Mobile device tokens cannot access admin metrics.
- The dashboard displays names and aggregate activity, habit, and completion counts. It does not return habit text. Activity is recorded after online sync; offline-only use is not visible.
- The Worker, remote D1 database, and admin website are deployed at `https://doto-api.doto-197796f7.workers.dev/`. Live checks confirmed missing and wrong admin tokens are rejected, a valid admin token works, mobile tokens cannot access admin metrics, and two separate device accounts cannot read each other's changes. Test records were removed afterward. The cloud APK has been built but not tested on a physical device.
