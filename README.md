# DOTO

**Small Steps. Big Streaks.** An Android-first, offline-first habit tracker built with Expo and TypeScript.

## Phase 1 status

Implemented: Expo Router navigation, a first-launch name screen, local SQLite storage, create/edit/archive/restore/delete habits, a native start-date calendar, optional once-daily or hourly-interval reminders, and one-tap completion with undo. Local changes and durable sync outbox entries commit together. The source runs offline by default; the current preview APK enables Cloudflare Worker + D1 sync. A protected web admin dashboard is deployed. See [Worker and admin setup](WORKER_SETUP.md) and [environment contracts](env-contracts.md).

The Plan tab arranges timed habits from morning to night and shows progress using the same daily completions as Home. Its separate Build your day page lets people add multiple moments in one place, change their names and times, assign a time to an existing habit, or remove a time without deleting the habit. A repeated reminder still has one completion per habit per day. The Calendar tab shows recorded activity by month. Home and Rewards show the current daily-goal streak: a day counts when every due habit is complete; an unfinished today leaves yesterday's streak visible until the day ends. Rewards also shows completed steps. Reminders require notification permission. A habit can notify once or every 1, 2, 3, or 4 hours between a first and last time; each slot is a local daily notification with the system default sound. Android may delay delivery for battery saving, and silent or disabled notification settings override sound. A habit with a future start date gets first-day reminders on that date and is switched to recurring daily reminders when the app next opens. Historical eligibility finalization, per-habit streaks, XP, achievements, and a store-ready release are **not implemented yet**. The Cloudflare Worker, D1, and admin website are deployed and passed a live cross-account test; the cloud APK still needs physical-device testing.

## Visual direction

DOTO uses a warm cream background, lavender surfaces, peach action accents, and a deep plum navigation bar. Its dashboard leads with today's progress and habit list; the reference food-tracking layout is only a visual cue, not a copied screen. Habit rows have one completion target and a separate details target. The dashboard shows the next unfinished habit and keeps future habits in a separate Coming up section. The creation form shows three random starter ideas from a pool of ten in regular-weight text, automatically picks a varied icon from the habit name, and offers quick start dates and reminder presets. Settings offers System, Light, and Dark appearance choices; the selection is stored locally. Completion uses a brief checkbox spring and haptic response; the animation is skipped when reduced motion is enabled.

## Run

```sh
npm install --legacy-peer-deps
npm start
```

Open the Expo development app on Android or use `npm run android` with an emulator. Run `npm run typecheck` and `npm test` for verification. No Android device was attached during this build, so device behavior has not been verified here.

On this Windows machine, the SDK 58 release build required Android CMake 3.31.6 and `expo.android.cmakeObjectPathMax=240` in the generated `android/gradle.properties`, plus a short temporary project path to keep native object filenames within Windows limits.

## Preview APK

The installable Android preview is [`artifacts/DOTO-0.1.13.apk`](artifacts/DOTO-0.1.13.apk). It includes the refreshed cream, lavender, peach, and plum UI, the Daily Plan tab and separate Build your day page, refined habit notifications, seated DOTO mascot, built-in habit tips and benefits, an optional short AI tip for unfamiliar habits, automatic habit icons, interval reminders, the name screen, daily-goal streak, Cloudflare sync, and a colored sync-status dot in Settings. Built-in and previously generated tips work offline. It contains only ARM64 native code and is 32.67 MiB; 32-bit ARM phones and x86 emulators are not supported. It is a release-mode APK signed with the same local preview certificate as the older `0.1.0` through `0.1.12` APKs, so Android can install it as an update over those previews without clearing app data. Package ID: `com.doto.habits`; version code: `14`. SHA-256: `39040289A463D3C94ACF286448C169ED7762C031670ABC5A805C1CE9B459F87B`. Earlier debug-signed builds have a different certificate and cannot be updated in place. Uninstalling erases local data. See [security review](SECURITY_REVIEW.md).

## Data and conflict rules for later phases

### Local data

- SQLite is the UI source. Screens never wait for a cloud request to save a habit.
- IDs and outbox operation IDs are UUIDs. `version` is the last acknowledged server version; `local_revision` advances on each local edit. Neither a device timestamp nor `local_revision` is treated as server ordering.
- `created_at` and `updated_at` are UTC event timestamps. `created_date` stores the selected local start date (default: creation date); `created_timezone` retains the habit's originating time zone. Completion rows have a local date and time zone. A time zone change affects new local dates only; past completion dates are not reinterpreted.
- The first migration already reserves completion, daily snapshot, sync metadata, and outbox tables. Subsequent phases must add SQL migrations rather than recreate data.

### Daily eligibility, streaks, and XP (Phase 2)

- A newly created habit is eligible from its selected start date. Archiving and deletion remove it from today's requirement; completed past dates remain recorded. A daily snapshot stores the exact eligible habit IDs, requirement count, and completion count. The current day snapshot is refreshed after habit and completion changes. Historical finalization and eligibility backfill remain Phase 2 work.
- The current overall streak counts consecutive calendar days where every due habit was completed. A day with no completed goal does not add a day; an unfinished today displays the streak through yesterday. Future completions are rejected. Neutral no-habit days and per-habit streaks remain Phase 2 work.
- Backdated completion edits will be allowed for the previous seven local dates and only for habits recorded as eligible on that date. Edits recalculate affected snapshots, streaks, and XP. No historical habit-list change can silently change a finalized requirement.
- XP is derived from completion facts: 10 per completed eligible habit and 20 for a fully completed eligible day. Undo removes those points. Level is `1 + floor(total XP / 100)`. Seven, 30, and 100 day badges derive from the highest achieved overall streak and each milestone is awarded once. Derivation avoids duplicate rewards from sync retries.

### Cloud synchronization (Phase 3)

- Each cloud request carries a random device token stored in SecureStore. The Worker hashes it, looks up its D1 user, and scopes every query to that user. The client cannot supply trusted ownership.
- The server will process operation UUIDs transactionally and idempotently. Each operation carries its base server version. A stale version produces a conflict response and the latest row, never a silent overwrite. The client will retain unsent local operations, download remote changes, and rebase explicit local edits. For a delete/edit race, deletion wins unless the user explicitly restores the item. A completion toggle conflict will reapply the user's latest local intent against the newly fetched server version with a bounded retry.
- Downloads will use a server cursor and owner-scoped incremental ordering. Uploads will be bounded and retried with exponential backoff. Synchronization is best-effort when the app has execution time, valid authentication, and connectivity.
- Guest records remain local until the server acknowledges them after sign-in. On ID collision with different content, the merge will preserve both records by remapping one stable ID and related references. Signing out will isolate account data from the next user.

## Implementation sequence

1. **Foundation (complete):** Expo, navigation, SQLite migration, complete local habit management, transactional outbox.
2. **Tracking (in progress):** completion and undo, today's eligibility snapshot, recorded-activity calendar, and a current overall daily-goal streak are present. Historical eligibility finalization, per-habit streaks, XP, and achievements remain.
3. **Cloud (preview deployed and built):** Cloudflare D1 schema, Worker device sessions, idempotent versioned sync, reconciliation tests, an admin website, and an ARM64 cloud APK. Physical-device testing remains.
4. **Experience:** onboarding, more robust future-start reminder recurrence, theme, animations, settings and sync visibility.
5. **Release:** device tests, security and performance checks, Android installable build, release documentation.

## Architecture and integrity risks

The main risks are history changing when habits are edited, duplicate rewards after retries, stale edits from two devices, and losing guest data during account linking. Dated snapshots, derived rewards, server-side compare-and-swap versions, and acknowledged guest migration address these respectively. SQLite outbox inserts share the write transaction so a local edit cannot commit without its future sync record.

The 1 November 2026 security pass upgraded DOTO to Expo SDK 58, React Native 0.88.1, and Vitest 5. After removing the unused Supabase dependencies, a fresh audit reported 0 vulnerabilities. Re-audit before public release; do not apply `npm audit fix --force` without checking Expo compatibility.
