# DOTO

**Small Steps. Big Streaks.** An Android-first, offline-first habit tracker built with Expo and TypeScript.

## Phase 1 status

Implemented: Expo Router navigation, a local SQLite database with versioned migrations, create/edit/archive/restore/delete habit flows, a native calendar picker for each habit's start date, an optional native time picker for daily local reminders, and one-tap daily completion with undo. Local mutations and their durable sync outbox operations commit in one SQLite transaction. Delete uses a tombstone so synchronization can propagate it. The app works as a local guest without configuration or network access. The source now also includes Supabase email/password sign-in, secure session storage, authenticated server RPCs, and best-effort upload/download sync. See [cloud setup](CLOUD_SETUP.md) and [environment contracts](env-contracts.md); no hosted project is configured yet.

The Calendar tab shows recorded activity by month. Rewards shows a count of completed steps. Reminders require notification permission; a habit with a future start date gets its first scheduled reminder on that date and is switched to a repeating daily reminder when the app next opens. Full historical daily eligibility, streaks, XP, achievements, and a store-ready release are **not implemented yet**. Cloud code has local and embedded-PostgreSQL tests, but a live Supabase deployment and physical-device test are still needed.

## Visual direction

DOTO uses a warm neutral background, soft peach action accents, and a dark navigation bar. Its dashboard leads with today's progress and habit list; the reference food-tracking layout is only a visual cue, not a copied screen. Habit rows have one completion target and a separate details target. The dashboard shows the next unfinished habit and keeps future habits in a separate Coming up section. The creation form shows three random starter ideas from a pool of ten in regular-weight text, plus quick start dates and reminder presets. Settings offers System, Light, and Dark appearance choices; the selection is stored locally. Completion uses a brief checkbox spring and haptic response; the animation is skipped when reduced motion is enabled.

## Run

```sh
npm install --legacy-peer-deps
npm start
```

Open the Expo development app on Android or use `npm run android` with an emulator. Run `npm run typecheck` and `npm test` for verification. No Android device was attached during this build, so device behavior has not been verified here.

On this Windows machine, the SDK 58 release build required Android CMake 3.31.6 and `expo.android.cmakeObjectPathMax=240` in the generated `android/gradle.properties`, plus a short temporary project path to keep native object filenames within Windows limits.

## Preview APK

The installable Android preview is [`artifacts/DOTO-personal-0.1.0.apk`](artifacts/DOTO-personal-0.1.0.apk). This **offline APK** was built before cloud support was added to the source. It contains only ARM64 native code, reducing the signed APK from 92.2 MiB to 30.2 MiB. It installs on ARM64 Android phones; 32-bit ARM phones and x86 emulators are not supported by this APK. It is a release-mode APK signed with a unique local preview key, intended for direct testing rather than Play Store submission. Package ID: `com.doto.habits`; version: `0.1.0`. SHA-256: `478528D39FBF33CDDA872A2243D374FE7FF1591A115DCC87FDC7AC5BF06C1564`. A cloud-enabled APK requires a configured Supabase project and a new build. Previous debug-signed APKs cannot be updated in place with this build; uninstalling the old APK also removes its local data. See [security review](SECURITY_REVIEW.md).

## Data and conflict rules for later phases

### Local data

- SQLite is the UI source. Screens never wait for a cloud request to save a habit.
- IDs and outbox operation IDs are UUIDs. `version` is the last acknowledged server version; `local_revision` advances on each local edit. Neither a device timestamp nor `local_revision` is treated as server ordering.
- `created_at` and `updated_at` are UTC event timestamps. `created_date` stores the selected local start date (default: creation date); `created_timezone` retains the habit's originating time zone. Completion rows have a local date and time zone. A time zone change affects new local dates only; past completion dates are not reinterpreted.
- The first migration already reserves completion, daily snapshot, sync metadata, and outbox tables. Subsequent phases must add SQL migrations rather than recreate data.

### Daily eligibility, streaks, and XP (Phase 2)

- A newly created habit is eligible from its selected start date. Archiving and deletion remove it from today's requirement; completed past dates remain recorded. A daily snapshot stores the exact eligible habit IDs, requirement count, and completion count. The current day snapshot is refreshed after habit and completion changes. Historical finalization and eligibility backfill remain Phase 2 work.
- A day with zero eligible habits is neutral and earns no overall streak or daily bonus. A habit streak counts consecutive eligible dates completed. The overall streak counts consecutive eligible dates where every required habit was completed. If today is unfinished, the displayed current streak is measured through yesterday. Future completions are rejected.
- Backdated completion edits will be allowed for the previous seven local dates and only for habits recorded as eligible on that date. Edits recalculate affected snapshots, streaks, and XP. No historical habit-list change can silently change a finalized requirement.
- XP is derived from completion facts: 10 per completed eligible habit and 20 for a fully completed eligible day. Undo removes those points. Level is `1 + floor(total XP / 100)`. Seven, 30, and 100 day badges derive from the highest achieved overall streak and each milestone is awarded once. Derivation avoids duplicate rewards from sync retries.

### Cloud synchronization (Phase 3)

- Each account-owned cloud row will be constrained by `auth.uid()` and RLS. The client will never supply trusted ownership. The mobile app will contain only the public Supabase URL and anon key; session credentials will use SecureStore.
- The server will process operation UUIDs transactionally and idempotently. Each operation carries its base server version. A stale version produces a conflict response and the latest row, never a silent overwrite. The client will retain unsent local operations, download remote changes, and rebase explicit local edits. For a delete/edit race, deletion wins unless the user explicitly restores the item. A completion toggle conflict will reapply the user's latest local intent against the newly fetched server version with a bounded retry.
- Downloads will use a server cursor and owner-scoped incremental ordering. Uploads will be bounded and retried with exponential backoff. Synchronization is best-effort when the app has execution time, valid authentication, and connectivity.
- Guest records remain local until the server acknowledges them after sign-in. On ID collision with different content, the merge will preserve both records by remapping one stable ID and related references. Signing out will isolate account data from the next user.

## Implementation sequence

1. **Foundation (complete):** Expo, navigation, SQLite migration, complete local habit management, transactional outbox.
2. **Tracking (in progress):** completion and undo, today's eligibility snapshot, and recorded-activity calendar are present. Historical eligibility finalization, pure streak/XP functions, achievements, and broader tests remain.
3. **Cloud (source implemented; deployment pending):** Supabase schema/RLS, auth, guest merge, idempotent versioned sync, reconciliation tests. A hosted project and device testing remain.
4. **Experience:** onboarding, more robust future-start reminder recurrence, theme, animations, settings and sync visibility.
5. **Release:** device tests, security and performance checks, Android installable build, release documentation.

## Architecture and integrity risks

The main risks are history changing when habits are edited, duplicate rewards after retries, stale edits from two devices, and losing guest data during account linking. Dated snapshots, derived rewards, server-side compare-and-swap versions, and acknowledged guest migration address these respectively. SQLite outbox inserts share the write transaction so a local edit cannot commit without its future sync record.

The 1 November 2026 security pass upgraded DOTO to Expo SDK 58, React Native 0.88.1, and Vitest 5. A fresh full `npm audit` reported 12 moderate advisories, with no high or critical findings. Review the remaining advisories before public release; do not apply `npm audit fix --force` without checking Expo compatibility.
