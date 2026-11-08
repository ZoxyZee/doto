import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { localDate } from '@/domain/habitRules';
import type { Habit } from '@/types/habit';

export type TodayProgress = { date: string; completedIds: string[]; requiredCount: number; completedCount: number };

function previousDay(day: string): string {
  const localNoon = new Date(`${day}T12:00:00`);
  localNoon.setDate(localNoon.getDate() - 1);
  return localDate(localNoon);
}

export async function getCurrentStreak(db: SQLiteDatabase, today: TodayProgress): Promise<number> {
  const achievedToday = today.requiredCount > 0 && today.completedCount === today.requiredCount;
  let streak = achievedToday ? 1 : 0;
  let expected = previousDay(today.date);
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM daily_snapshots WHERE date < ? AND goal_achieved = 1 ORDER BY date DESC', today.date,
  );
  for (const row of rows) {
    if (row.date !== expected) break;
    streak += 1;
    expected = previousDay(expected);
  }
  return streak;
}

function timezone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }

async function eligibleIds(db: SQLiteDatabase, date: string): Promise<string[]> {
  const rows = await db.getAllAsync<Pick<Habit, 'id'>>(
    'SELECT id FROM habits WHERE deleted_at IS NULL AND archived_at IS NULL AND created_date <= ? ORDER BY id', date,
  );
  return rows.map((row) => row.id);
}

export async function refreshTodaySnapshot(tx: SQLiteDatabase, date = localDate(new Date())): Promise<void> {
  const ids = await eligibleIds(tx, date);
  const completedRow = await tx.getFirstAsync<{ count: number }>(
    `SELECT count(*) AS count FROM habit_completions WHERE completion_date = ? AND is_completed = 1
     AND habit_id IN (SELECT id FROM habits WHERE deleted_at IS NULL AND archived_at IS NULL AND created_date <= ?)`, date, date,
  );
  const count = completedRow?.count ?? 0;
  await tx.runAsync(
    `INSERT INTO daily_snapshots (date, timezone, eligible_habit_ids, completed_count, required_count, goal_achieved)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET eligible_habit_ids = excluded.eligible_habit_ids,
     completed_count = excluded.completed_count, required_count = excluded.required_count,
     goal_achieved = excluded.goal_achieved`,
    date, timezone(), JSON.stringify(ids), count, ids.length, ids.length > 0 && count === ids.length ? 1 : 0,
  );
}

export async function getTodayProgress(db: SQLiteDatabase, date = localDate(new Date())): Promise<TodayProgress> {
  const ids = await eligibleIds(db, date);
  const rows = await db.getAllAsync<{ habit_id: string }>(
    `SELECT c.habit_id FROM habit_completions c JOIN habits h ON h.id = c.habit_id
     WHERE c.completion_date = ? AND c.is_completed = 1 AND h.deleted_at IS NULL AND h.archived_at IS NULL`, date,
  );
  const completedIds = rows.map((row) => row.habit_id).filter((id) => ids.includes(id));
  return { date, completedIds, requiredCount: ids.length, completedCount: completedIds.length };
}

export async function setTodayCompleted(db: SQLiteDatabase, habitId: string, completed: boolean): Promise<void> {
  const now = new Date();
  const date = localDate(now);
  const timestamp = now.toISOString();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const habit = await tx.getFirstAsync<Habit>(
      'SELECT * FROM habits WHERE id = ? AND deleted_at IS NULL AND archived_at IS NULL AND created_date <= ?', habitId, date,
    );
    if (!habit) throw new Error('This habit is not available today.');
    const previous = await tx.getFirstAsync<{ id: string; version: number; local_revision: number }>(
      'SELECT id, version, local_revision FROM habit_completions WHERE habit_id = ? AND completion_date = ?', habitId, date,
    );
    const completion = {
      id: previous?.id ?? Crypto.randomUUID(), habit_id: habitId, completion_date: date,
      completion_timezone: timezone(), is_completed: completed ? 1 : 0,
      created_at: timestamp, updated_at: timestamp,
      version: previous?.version ?? 0, local_revision: (previous?.local_revision ?? 0) + 1,
    };
    await tx.runAsync(
      `INSERT INTO habit_completions (id, habit_id, completion_date, completion_timezone, is_completed, created_at, updated_at, version, local_revision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(habit_id, completion_date) DO UPDATE SET
       completion_timezone = excluded.completion_timezone, is_completed = excluded.is_completed,
       updated_at = excluded.updated_at, local_revision = excluded.local_revision`,
      completion.id, completion.habit_id, completion.completion_date, completion.completion_timezone,
      completion.is_completed, completion.created_at, completion.updated_at, completion.version, completion.local_revision,
    );
    await tx.runAsync(
      `INSERT INTO sync_outbox (operation_id, entity_type, entity_id, operation_type, payload, created_at)
       VALUES (?, 'completion', ?, 'set', ?, ?)`,
      Crypto.randomUUID(), completion.id, JSON.stringify(completion), timestamp,
    );
    await refreshTodaySnapshot(tx, date);
  });
}
