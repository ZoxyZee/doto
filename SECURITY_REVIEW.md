# DOTO preview security review — 1 November 2026 (APK refreshed 6 November 2026)

The security review was performed on 1 November 2026. The offline APK was rebuilt on 6 November for ARM64 only, reducing its size. Its package, permissions, alignment, and signing were checked again. Cloud sync source was added later on 6 November and is **not in this APK**. It is a preview build, not a public release assessment. No Android device was connected for runtime testing.

## Checks and changes

- Scanned the offline APK source and configuration for hardcoded keys, passwords, and endpoints. None were found. The reviewed APK has no account or cloud connection.
- Confirmed habit and completion SQL writes use bound parameters and exclusive transactions; the related outbox record is written in the same transaction.
- Disabled Android Auto Backup for the local SQLite database. This improves privacy but means local habits will not restore automatically after a device reset or transfer.
- Removed Android network, network state, legacy external storage, system overlay, and FCM receive permissions from the final APK. Local reminders retain notification, boot, wake lock, and vibration permissions. Expo Notifications still contributes launcher badge permissions.
- Removed the unused external `doto://` link handler. The app's launcher activity remains exported as Android requires; other app components are either not exported or protected by a platform permission.
- Upgraded to Expo SDK 58 and React Native 0.88.1, including patched Expo Router 58.0.29. Added Expo Router's required `expo-linking` peer. Upgraded Vitest to 5.0.5 to remove critical test-tool advisories. `npm run typecheck` and all six repository tests pass. The Android release build passed for arm64, 32-bit ARM, x86, and x86-64.
- Re-signed the APK with a unique 3072-bit RSA preview key. APK Signature Scheme v2 and v3 verification passed. The key and passwords are stored only under the ignored local `.build-tools/signing/` directory; back them up securely before using this identity for future updates.

## Remaining risks and limits

- The original full `npm audit` reported **12 moderate advisories, 0 high, and 0 critical**. After cloud dependencies were added, a fresh full audit reported **8 moderate, 0 high, and 0 critical**. Re-audit before public release.
- Habit data remains plaintext within Android's app-private SQLite storage. There is no app PIN or database encryption. Anyone with access to an unlocked or compromised device may be able to access it.
- No physical-device install, reminder, or behavior test was possible here. The permission reduction and signing were verified from the built APK.
- The new preview certificate differs from earlier debug-signed APKs. Android will not install it as an in-place update over those builds; uninstalling the older app erases its local database.
- This preview key is not a Play Store upload key. Before a public release, use managed release credentials, re-audit dependencies, and test on a real Android device.

## Cloud source added after the APK build

- The source now permits Android internet access and uses only `EXPO_PUBLIC_SUPABASE_URL` and a publishable key. No project credentials are configured or committed. Account sessions are chunked into Expo SecureStore; habit data remains in local SQLite.
- The [environment contract](env-contracts.md) defines the two allowed mobile variables and forbidden secrets. Expo config rejects partial cloud settings, non-HTTPS endpoints, and secret-key formats before bundling. `.env*` files are ignored by Git while `.env.example` remains shareable.
- The SQL migration enables RLS, grants owner-scoped reads, revokes direct client writes, and restricts the security-definer sync functions to authenticated callers. Each function checks `auth.uid()` and uses a fixed search path. An embedded PostgreSQL test checks the migration, ownership, idempotent retries, version conflicts, and completion collisions.
- Client integration tests cover guest merge, offline retry after a lost acknowledgement, edit and deletion conflicts, completion ID reconciliation, and sign-out cleanup. All 14 repository tests and TypeScript checking pass.
- A real Supabase deployment, live cross-account access test, and physical-device test remain required before a cloud APK can be treated as verified. The current APK hash below identifies the older offline build.

## Artifact identity

- Package: `com.doto.habits`, version `0.1.0`
- APK SHA-256: `478528D39FBF33CDDA872A2243D374FE7FF1591A115DCC87FDC7AC5BF06C1564`
- Signing certificate SHA-256: `f1fd96bfd63c0bc5168157cc12063b9880a73e4d4427a5c1e92b600277d348c6`
