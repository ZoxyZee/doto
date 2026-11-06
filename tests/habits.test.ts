import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from '../src/database/migrations';
import { createHabit, deleteHabit, getHabit, listHabits, setHabitArchived, updateHabit } from '../src/database/habitRepository';
import { HABIT_COLORS, HABIT_ICONS, validateHabit } from '../src/domain/habitRules';
import { getTodayProgress, setTodayCompleted } from '../src/database/completionRepository';

vi.mock('expo-crypto', () => {
  let sequence = 0;
  return { randomUUID: () => `test-id-${++sequence}` };
});

function adapter(raw: DatabaseSync): SQLiteDatabase {
  const db = {
    execAsync: async (sql: string) => { raw.exec(sql); },
    runAsync: async (sql: string, ...args: unknown[]) => { raw.prepare(sql).run(...(args as [])); },
    getFirstAsync: async <T>(sql: string, ...args: unknown[]): Promise<T | null> => (raw.prepare(sql).get(...(args as [])) as T | undefined) ?? null,
    getAllAsync: async <T>(sql: string, ...args: unknown[]): Promise<T[]> => raw.prepare(sql).all(...(args as [])) as T[],
    withExclusiveTransactionAsync: async (callback: (tx: SQLiteDatabase) => Promise<void>) => {
      raw.exec('BEGIN IMMEDIATE');
      try { await callback(db as unknown as SQLiteDatabase); raw.exec('COMMIT'); }
      catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  };
  return db as unknown as SQLiteDatabase;
}

const input = { name: ' Read ', description: '  A few pages  ', icon: HABIT_ICONS[1], color: HABIT_COLORS[0] };
let raw: DatabaseSync;
let db: SQLiteDatabase;

beforeEach(async () => { raw = new DatabaseSync(':memory:'); db = adapter(raw); await migrateDatabase(db); });
afterEach(() => raw.close());

describe('Phase 1 local habits', () => {
  it('migrates only once and validates the form', async () => {
    await migrateDatabase(db);
    expect(raw.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 1 });
    expect(validateHabit(input).name).toBe('Read');
    expect(() => validateHabit({ ...input, name: '  ' })).toThrow();
  });

  it('creates and edits a habit with durable outbox operations', async () => {
    const created = await createHabit(db, input);
    expect((await getHabit(db, created.id))?.name).toBe('Read');
    expect((await listHabits(db)).length).toBe(1);
    await updateHabit(db, created.id, { ...input, name: 'Walk' });
    expect((await getHabit(db, created.id))?.name).toBe('Walk');
    expect(raw.prepare('SELECT count(*) AS count FROM sync_outbox').get()).toMatchObject({ count: 2 });
  });

  it('saves a future start date and reminder time, then updates eligibility when edited', async () => {
    const future = '2099-02-14';
    const created = await createHabit(db, { ...input, created_date: future, reminder_enabled: 1, reminder_time: '08:30' });
    expect(await getTodayProgress(db)).toMatchObject({ requiredCount: 0 });
    expect(await getHabit(db, created.id)).toMatchObject({ created_date: future, reminder_enabled: 1, reminder_time: '08:30' });
    await expect(setTodayCompleted(db, created.id, true)).rejects.toThrow('not available today');
    await updateHabit(db, created.id, { ...input, created_date: '2020-01-01', reminder_enabled: 0 });
    expect(await getTodayProgress(db)).toMatchObject({ requiredCount: 1 });
    expect(await getHabit(db, created.id)).toMatchObject({ created_date: '2020-01-01', reminder_enabled: 0, reminder_time: null });
    expect(() => validateHabit({ ...input, created_date: '2026-02-30' })).toThrow();
    expect(() => validateHabit({ ...input, reminder_enabled: 1, reminder_time: '25:30' })).toThrow();
  });

  it('archives, restores, and soft deletes without losing the row', async () => {
    const habit = await createHabit(db, input);
    expect(raw.prepare('SELECT required_count FROM daily_snapshots').get()).toMatchObject({ required_count: 1 });
    await setHabitArchived(db, habit.id, true);
    expect(raw.prepare('SELECT required_count FROM daily_snapshots').get()).toMatchObject({ required_count: 0 });
    expect(await listHabits(db)).toEqual([]);
    expect((await listHabits(db, true)).length).toBe(1);
    await setHabitArchived(db, habit.id, false);
    expect(raw.prepare('SELECT required_count FROM daily_snapshots').get()).toMatchObject({ required_count: 1 });
    expect((await listHabits(db)).length).toBe(1);
    await deleteHabit(db, habit.id);
    expect(raw.prepare('SELECT required_count FROM daily_snapshots').get()).toMatchObject({ required_count: 0 });
    expect(await getHabit(db, habit.id)).toBeNull();
    expect(raw.prepare('SELECT deleted_at FROM habits WHERE id = ?').get(habit.id)).toHaveProperty('deleted_at');
    expect(raw.prepare('SELECT count(*) AS count FROM sync_outbox').get()).toMatchObject({ count: 4 });
  });

  it('rolls back a write if its outbox insert fails', async () => {
    raw.exec(`CREATE TRIGGER reject_outbox BEFORE INSERT ON sync_outbox BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;`);
    await expect(createHabit(db, input)).rejects.toThrow();
    expect(raw.prepare('SELECT count(*) AS count FROM habits').get()).toMatchObject({ count: 0 });
  });

  it('persists a completion, supports undo, and updates daily progress atomically', async () => {
    const habit = await createHabit(db, input);
    await setTodayCompleted(db, habit.id, true);
    expect(await getTodayProgress(db)).toMatchObject({ requiredCount: 1, completedCount: 1 });
    expect(raw.prepare('SELECT goal_achieved FROM daily_snapshots').get()).toMatchObject({ goal_achieved: 1 });
    await setTodayCompleted(db, habit.id, false);
    expect(await getTodayProgress(db)).toMatchObject({ requiredCount: 1, completedCount: 0 });
    expect(raw.prepare('SELECT goal_achieved FROM daily_snapshots').get()).toMatchObject({ goal_achieved: 0 });
    expect(raw.prepare('SELECT count(*) AS count FROM sync_outbox').get()).toMatchObject({ count: 3 });
  });
});
