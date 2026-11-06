import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { validateHabit } from '@/domain/habitRules';
import { refreshTodaySnapshot } from '@/database/completionRepository';
import type { Habit, HabitInput } from '@/types/habit';

function id(): string { return Crypto.randomUUID(); }
function timezone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }

async function enqueue(tx: SQLiteDatabase, habit: Habit, operationType: string): Promise<void> {
  await tx.runAsync(
    `INSERT INTO sync_outbox (operation_id, entity_type, entity_id, operation_type, payload, created_at)
     VALUES (?, 'habit', ?, ?, ?, ?)`,
    id(), habit.id, operationType, JSON.stringify(habit), habit.updated_at,
  );
}

export async function listHabits(db: SQLiteDatabase, archived = false): Promise<Habit[]> {
  return db.getAllAsync<Habit>(
    `SELECT * FROM habits WHERE deleted_at IS NULL AND archived_at IS ${archived ? 'NOT NULL' : 'NULL'}
     ORDER BY created_at DESC, id DESC`,
  );
}

export async function getHabit(db: SQLiteDatabase, habitId: string): Promise<Habit | null> {
  return (await db.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ? AND deleted_at IS NULL', habitId)) ?? null;
}

export async function createHabit(db: SQLiteDatabase, input: HabitInput): Promise<Habit> {
  const clean = validateHabit(input);
  const now = new Date();
  const habit: Habit = {
    id: id(), owner_id: null, ...clean,
    created_at: now.toISOString(), updated_at: now.toISOString(),
    archived_at: null, deleted_at: null,
    version: 0, local_revision: 1, created_timezone: timezone(),
  };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO habits (id, owner_id, name, description, icon, color, created_at, updated_at,
        archived_at, deleted_at, reminder_enabled, reminder_time, version, local_revision, created_date, created_timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      habit.id, habit.owner_id, habit.name, habit.description, habit.icon, habit.color,
      habit.created_at, habit.updated_at, habit.archived_at, habit.deleted_at,
      habit.reminder_enabled, habit.reminder_time, habit.version, habit.local_revision,
      habit.created_date, habit.created_timezone,
    );
    await enqueue(tx, habit, 'create');
    await refreshTodaySnapshot(tx);
  });
  return habit;
}

export async function updateHabit(db: SQLiteDatabase, habitId: string, input: HabitInput): Promise<Habit> {
  const clean = validateHabit(input);
  let result: Habit | null = null;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const previous = await tx.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ? AND deleted_at IS NULL', habitId);
    if (!previous) throw new Error('Habit no longer exists.');
    const next: Habit = { ...previous, ...clean, updated_at: new Date().toISOString(), local_revision: previous.local_revision + 1 };
    await tx.runAsync(
      `UPDATE habits SET name = ?, description = ?, icon = ?, color = ?, created_date = ?, reminder_enabled = ?, reminder_time = ?, updated_at = ?, local_revision = ?
       WHERE id = ?`,
      next.name, next.description, next.icon, next.color, next.created_date, next.reminder_enabled, next.reminder_time, next.updated_at, next.local_revision, next.id,
    );
    await enqueue(tx, next, 'update');
    await refreshTodaySnapshot(tx);
    result = next;
  });
  return result!;
}

export async function setHabitArchived(db: SQLiteDatabase, habitId: string, archived: boolean): Promise<Habit> {
  let result: Habit | null = null;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const previous = await tx.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ? AND deleted_at IS NULL', habitId);
    if (!previous) throw new Error('Habit no longer exists.');
    const now = new Date().toISOString();
    const next: Habit = { ...previous, archived_at: archived ? now : null, updated_at: now, local_revision: previous.local_revision + 1 };
    await tx.runAsync('UPDATE habits SET archived_at = ?, updated_at = ?, local_revision = ? WHERE id = ?', next.archived_at, now, next.local_revision, habitId);
    await enqueue(tx, next, archived ? 'archive' : 'restore');
    await refreshTodaySnapshot(tx);
    result = next;
  });
  return result!;
}

export async function deleteHabit(db: SQLiteDatabase, habitId: string): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    const previous = await tx.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ? AND deleted_at IS NULL', habitId);
    if (!previous) throw new Error('Habit no longer exists.');
    const now = new Date().toISOString();
    const next: Habit = { ...previous, deleted_at: now, updated_at: now, local_revision: previous.local_revision + 1 };
    await tx.runAsync('UPDATE habits SET deleted_at = ?, updated_at = ?, local_revision = ? WHERE id = ?', now, now, next.local_revision, habitId);
    await enqueue(tx, next, 'delete');
    await refreshTodaySnapshot(tx);
  });
}
