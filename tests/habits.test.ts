import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from '../src/database/migrations';
import { createHabit, deleteHabit, getHabit, listHabits, setHabitArchived, updateHabit } from '../src/database/habitRepository';
import { HABIT_COLORS, HABIT_ICONS, pickHabitIcon, validateHabit } from '../src/domain/habitRules';
import { getHabitGuidance } from '../src/domain/habitGuidance';
import { reminderTimes } from '../src/domain/reminderSchedule';
import { getCurrentStreak, getTodayProgress, setTodayCompleted } from '../src/database/completionRepository';

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
  it('chooses a varied icon that fits the habit name', () => {
    expect(pickHabitIcon('Drink water', () => 0)).toBe('water-outline');
    expect(pickHabitIcon('Drink water', () => 0.99)).toBe('pint-outline');
    expect(pickHabitIcon('Drinking water', () => 0)).toBe('water-outline');
    expect(pickHabitIcon('Read for 10 minutes', () => 0.99)).toBe('library-outline');
    expect(pickHabitIcon('Reading each night', () => 0)).toBe('book-outline');
    expect(pickHabitIcon('Take a walk', () => 0.99)).toBe('barbell-outline');
    expect(pickHabitIcon('Go to bed early', () => 0)).toBe('moon-outline');
    expect(HABIT_ICONS).toContain(pickHabitIcon('Practice patience', () => 0.5));
  });
  it('shows relevant habit tips and a general fallback', () => {
    expect(getHabitGuidance('Sleep early')?.tip).toContain('consistent bedtime');
    expect(getHabitGuidance('Go to bed on time')?.benefits).toContain('May support focus');
    expect(getHabitGuidance('Drink a glass of water')?.tip).toContain('glass or bottle');
    expect(getHabitGuidance('Practice patience')?.tip).toContain('two-minute version');
    expect(getHabitGuidance('  ')).toBeNull();
  });
  it('migrates only once and validates the form', async () => {
    await migrateDatabase(db);
    expect(raw.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 3 });
    expect(validateHabit(input).name).toBe('Read');
    expect(() => validateHabit({ ...input, name: '  ' })).toThrow();
  });

  it('upgrades an existing database without changing its saved reminders', async () => {
    const old = new DatabaseSync(':memory:');
    try {
      old.exec("CREATE TABLE habits (id TEXT PRIMARY KEY, reminder_time TEXT); INSERT INTO habits VALUES ('old', '09:00'); PRAGMA user_version = 1;");
      await migrateDatabase(adapter(old));
      expect(old.prepare('SELECT reminder_time, reminder_interval_minutes, reminder_end_time FROM habits WHERE id = ?').get('old'))
        .toMatchObject({ reminder_time: '09:00', reminder_interval_minutes: null, reminder_end_time: null });
    } finally { old.close(); }
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

  it('saves repeated reminders and validates the daily window', async () => {
    const created = await createHabit(db, { ...input, reminder_enabled: 1, reminder_time: '08:30', reminder_interval_minutes: 120, reminder_end_time: '18:30' });
    expect(await getHabit(db, created.id)).toMatchObject({ reminder_interval_minutes: 120, reminder_end_time: '18:30' });
    expect(reminderTimes('08:30', '18:30', 120)).toEqual(['08:30', '10:30', '12:30', '14:30', '16:30', '18:30']);
    await updateHabit(db, created.id, { ...input, reminder_enabled: 1, reminder_time: '09:00' });
    expect(await getHabit(db, created.id)).toMatchObject({ reminder_interval_minutes: null, reminder_end_time: null });
    expect(reminderTimes('09:00', null, null)).toEqual(['09:00']);
    expect(() => validateHabit({ ...input, reminder_enabled: 1, reminder_time: '20:00', reminder_interval_minutes: 60, reminder_end_time: '08:00' })).toThrow();
    expect(() => validateHabit({ ...input, reminder_enabled: 1, reminder_time: '09:00', reminder_interval_minutes: 45, reminder_end_time: '18:00' })).toThrow();
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
    expect(await getCurrentStreak(db, await getTodayProgress(db))).toBe(1);
    expect(raw.prepare('SELECT goal_achieved FROM daily_snapshots').get()).toMatchObject({ goal_achieved: 1 });
    await setTodayCompleted(db, habit.id, false);
    expect(await getTodayProgress(db)).toMatchObject({ requiredCount: 1, completedCount: 0 });
    expect(await getCurrentStreak(db, await getTodayProgress(db))).toBe(0);
    expect(raw.prepare('SELECT goal_achieved FROM daily_snapshots').get()).toMatchObject({ goal_achieved: 0 });
    expect(raw.prepare('SELECT count(*) AS count FROM sync_outbox').get()).toMatchObject({ count: 3 });
  });

  it('keeps yesterday’s goal streak until today is complete, then extends it', async () => {
    const saveDay = raw.prepare(`INSERT INTO daily_snapshots
      (date, timezone, eligible_habit_ids, completed_count, required_count, goal_achieved)
      VALUES (?, 'UTC', '[]', 1, 1, ?)`);
    saveDay.run('2026-11-03', 1);
    saveDay.run('2026-11-04', 1);
    saveDay.run('2026-11-05', 1);
    const today = { date: '2026-11-06', completedIds: [], requiredCount: 2, completedCount: 1 };
    expect(await getCurrentStreak(db, today)).toBe(3);
    expect(await getCurrentStreak(db, { ...today, completedCount: 2 })).toBe(4);
    expect(await getCurrentStreak(db, { ...today, completedCount: 2 })).toBe(4);
  });

  it('resets on a missed day and handles month boundaries', async () => {
    const saveDay = raw.prepare(`INSERT INTO daily_snapshots
      (date, timezone, eligible_habit_ids, completed_count, required_count, goal_achieved)
      VALUES (?, 'UTC', '[]', 1, 1, 1)`);
    saveDay.run('2026-02-27');
    saveDay.run('2026-02-28');
    const today = { date: '2026-03-01', completedIds: [], requiredCount: 1, completedCount: 1 };
    expect(await getCurrentStreak(db, today)).toBe(3);
    raw.prepare("UPDATE daily_snapshots SET completed_count = 0, goal_achieved = 0 WHERE date = '2026-02-28'").run();
    expect(await getCurrentStreak(db, today)).toBe(1);
    expect(await getCurrentStreak(db, { ...today, completedCount: 0 })).toBe(0);
  });
});
