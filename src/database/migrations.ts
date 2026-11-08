import type { SQLiteDatabase } from 'expo-sqlite';

type Migration = { version: number; sql: string };

const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE habits (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
        description TEXT,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        deleted_at TEXT,
        reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK(reminder_enabled IN (0,1)),
        reminder_time TEXT,
        version INTEGER NOT NULL DEFAULT 0,
        local_revision INTEGER NOT NULL DEFAULT 1,
        created_date TEXT NOT NULL,
        created_timezone TEXT NOT NULL
      );
      CREATE INDEX habits_active_idx ON habits(deleted_at, archived_at, created_at);
      CREATE TABLE habit_completions (
        id TEXT PRIMARY KEY,
        habit_id TEXT NOT NULL REFERENCES habits(id),
        completion_date TEXT NOT NULL,
        completion_timezone TEXT NOT NULL,
        is_completed INTEGER NOT NULL CHECK(is_completed IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        local_revision INTEGER NOT NULL DEFAULT 1,
        UNIQUE(habit_id, completion_date)
      );
      CREATE INDEX completion_date_idx ON habit_completions(completion_date, habit_id);
      CREATE TABLE daily_snapshots (
        date TEXT PRIMARY KEY,
        timezone TEXT NOT NULL,
        eligible_habit_ids TEXT NOT NULL,
        completed_count INTEGER NOT NULL DEFAULT 0,
        required_count INTEGER NOT NULL DEFAULT 0,
        goal_achieved INTEGER NOT NULL DEFAULT 0 CHECK(goal_achieved IN (0,1)),
        finalized_at TEXT
      );
      CREATE TABLE sync_outbox (
        operation_id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT,
        next_attempt_at TEXT
      );
      CREATE INDEX sync_pending_idx ON sync_outbox(status, next_attempt_at, created_at);
      CREATE TABLE sync_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE habits ADD COLUMN reminder_interval_minutes INTEGER;
      ALTER TABLE habits ADD COLUMN reminder_end_time TEXT;
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE habit_guidance_cache (
        name_key TEXT PRIMARY KEY,
        tip TEXT NOT NULL,
        benefit_one TEXT NOT NULL,
        benefit_two TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
];

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(migration.sql);
      await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }
}
