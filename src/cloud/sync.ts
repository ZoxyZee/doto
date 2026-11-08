import * as Crypto from 'expo-crypto';
import type { CloudClient } from '@/cloud/client';
import type { SQLiteDatabase } from 'expo-sqlite';
import { refreshTodaySnapshot } from '@/database/completionRepository';
import { cancelReminder } from '@/notifications/reminders';
import type { Habit } from '@/types/habit';
import { workerRequest } from '@/cloud/api';

type Completion = {
  id: string; habit_id: string; completion_date: string; completion_timezone: string;
  is_completed: number; created_at: string; updated_at: string;
  version: number; local_revision: number;
};
type EntityType = 'habit' | 'completion';
type Outbox = {
  operation_id: string; entity_type: EntityType; entity_id: string;
  operation_type: string; payload: string; retry_count: number;
};
type ApplyResult = {
  status: 'applied' | 'conflict' | 'missing';
  payload?: Habit | Completion; version?: number; revision?: number;
};
type Change = {
  revision: number; entity_type: EntityType; entity_id: string;
  payload: Habit | Completion; version: number;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Cloud sync failed.';
}

export async function pendingChanges(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM sync_outbox WHERE status = 'pending'");
  return row?.count ?? 0;
}

async function getVersion(db: SQLiteDatabase, operation: Outbox): Promise<number> {
  const table = operation.entity_type === 'habit' ? 'habits' : 'habit_completions';
  const row = await db.getFirstAsync<{ version: number }>(`SELECT version FROM ${table} WHERE id = ?`, operation.entity_id);
  if (!row) throw new Error('A queued change has no local record.');
  return row.version;
}

async function updateVersion(db: SQLiteDatabase, operation: Outbox, version: number, ownerId?: string): Promise<void> {
  if (operation.entity_type === 'habit') {
    await db.runAsync('UPDATE habits SET version = ?, owner_id = COALESCE(?, owner_id) WHERE id = ?', version, ownerId ?? null, operation.entity_id);
  } else {
    await db.runAsync('UPDATE habit_completions SET version = ? WHERE id = ?', version, operation.entity_id);
  }
}

async function remapHabit(db: SQLiteDatabase, oldId: string): Promise<void> {
  const nextId = Crypto.randomUUID();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const habit = await tx.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ?', oldId);
    if (!habit) throw new Error('Could not preserve the colliding habit.');
    await tx.runAsync(
      `INSERT INTO habits (id, owner_id, name, description, icon, color, created_at, updated_at,
       archived_at, deleted_at, reminder_enabled, reminder_time, reminder_interval_minutes, reminder_end_time,
       version, local_revision, created_date, created_timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      nextId, habit.owner_id, habit.name, habit.description, habit.icon, habit.color,
      habit.created_at, habit.updated_at, habit.archived_at, habit.deleted_at,
      habit.reminder_enabled, habit.reminder_time, habit.reminder_interval_minutes ?? null, habit.reminder_end_time ?? null,
      habit.local_revision, habit.created_date, habit.created_timezone,
    );
    await tx.runAsync('UPDATE habit_completions SET habit_id = ? WHERE habit_id = ?', nextId, oldId);
    await tx.runAsync('DELETE FROM habits WHERE id = ?', oldId);
    const queued = await tx.getAllAsync<Outbox>("SELECT * FROM sync_outbox WHERE status = 'pending'");
    for (const item of queued) {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      if (item.entity_type === 'habit' && item.entity_id === oldId) {
        payload.id = nextId;
        payload.version = 0;
        await tx.runAsync('UPDATE sync_outbox SET entity_id = ?, payload = ? WHERE operation_id = ?', nextId, JSON.stringify(payload), item.operation_id);
      } else if (item.entity_type === 'completion' && payload.habit_id === oldId) {
        payload.habit_id = nextId;
        await tx.runAsync('UPDATE sync_outbox SET payload = ? WHERE operation_id = ?', JSON.stringify(payload), item.operation_id);
      }
    }
    const snapshots = await tx.getAllAsync<{ date: string; eligible_habit_ids: string }>('SELECT date, eligible_habit_ids FROM daily_snapshots');
    for (const snapshot of snapshots) {
      const ids = JSON.parse(snapshot.eligible_habit_ids) as string[];
      if (ids.includes(oldId)) await tx.runAsync('UPDATE daily_snapshots SET eligible_habit_ids = ? WHERE date = ?', JSON.stringify(ids.map((id) => id === oldId ? nextId : id)), snapshot.date);
    }
  });
  await cancelReminder(oldId).catch(() => undefined);
}

async function remapCompletion(db: SQLiteDatabase, oldId: string, remoteId: string, version: number): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE habit_completions SET id = ?, version = ? WHERE id = ?', remoteId, version, oldId);
    const queued = await tx.getAllAsync<Outbox>("SELECT * FROM sync_outbox WHERE entity_type = 'completion' AND entity_id = ? AND status = 'pending'", oldId);
    for (const item of queued) {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      payload.id = remoteId;
      await tx.runAsync('UPDATE sync_outbox SET entity_id = ?, payload = ? WHERE operation_id = ?', remoteId, JSON.stringify(payload), item.operation_id);
    }
  });
}

async function remoteDeleteWins(db: SQLiteDatabase, habit: Habit): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await upsertHabit(tx, habit);
    const queued = await tx.getAllAsync<Outbox>("SELECT * FROM sync_outbox WHERE status = 'pending'");
    for (const item of queued) {
      const completion = item.entity_type === 'completion' ? JSON.parse(item.payload) as Completion : null;
      if ((item.entity_type === 'habit' && item.entity_id === habit.id) || completion?.habit_id === habit.id) {
        await tx.runAsync('DELETE FROM sync_outbox WHERE operation_id = ?', item.operation_id);
      }
    }
  });
  await cancelReminder(habit.id).catch(() => undefined);
}

async function upsertHabit(db: SQLiteDatabase, habit: Habit): Promise<void> {
  await db.runAsync(
    `INSERT INTO habits (id, owner_id, name, description, icon, color, created_at, updated_at,
     archived_at, deleted_at, reminder_enabled, reminder_time, reminder_interval_minutes, reminder_end_time,
     version, local_revision, created_date, created_timezone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET owner_id = excluded.owner_id, name = excluded.name,
     description = excluded.description, icon = excluded.icon, color = excluded.color,
     created_at = excluded.created_at, updated_at = excluded.updated_at,
     archived_at = excluded.archived_at, deleted_at = excluded.deleted_at,
     reminder_enabled = excluded.reminder_enabled, reminder_time = excluded.reminder_time,
     reminder_interval_minutes = excluded.reminder_interval_minutes, reminder_end_time = excluded.reminder_end_time,
     version = excluded.version, local_revision = excluded.local_revision,
     created_date = excluded.created_date, created_timezone = excluded.created_timezone`,
    habit.id, habit.owner_id, habit.name, habit.description, habit.icon, habit.color,
    habit.created_at, habit.updated_at, habit.archived_at, habit.deleted_at,
    habit.reminder_enabled, habit.reminder_time, habit.reminder_interval_minutes ?? null, habit.reminder_end_time ?? null,
    habit.version, habit.local_revision,
    habit.created_date, habit.created_timezone,
  );
}

async function upsertCompletion(db: SQLiteDatabase, completion: Completion): Promise<void> {
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM habit_completions WHERE habit_id = ? AND completion_date = ?',
    completion.habit_id, completion.completion_date,
  );
  if (existing && existing.id !== completion.id) {
    await db.runAsync('DELETE FROM habit_completions WHERE id = ?', existing.id);
  }
  await db.runAsync(
    `INSERT INTO habit_completions (id, habit_id, completion_date, completion_timezone,
     is_completed, created_at, updated_at, version, local_revision)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET habit_id = excluded.habit_id,
     completion_date = excluded.completion_date, completion_timezone = excluded.completion_timezone,
     is_completed = excluded.is_completed, created_at = excluded.created_at,
     updated_at = excluded.updated_at, version = excluded.version,
     local_revision = excluded.local_revision`,
    completion.id, completion.habit_id, completion.completion_date,
    completion.completion_timezone, completion.is_completed, completion.created_at,
    completion.updated_at, completion.version, completion.local_revision,
  );
}

async function pushOne(db: SQLiteDatabase, cloud: CloudClient, userId: string, operationId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const operation = await db.getFirstAsync<Outbox>('SELECT * FROM sync_outbox WHERE operation_id = ?', operationId);
    if (!operation) return;
    const baseVersion = await getVersion(db, operation);
    const result = await workerRequest<ApplyResult>(cloud, 'api/sync/apply', {
      p_operation_id: operation.operation_id,
      p_entity_type: operation.entity_type,
      p_entity_id: operation.entity_id,
      p_base_version: baseVersion,
      p_payload: JSON.parse(operation.payload),
    });
    if (result.status === 'applied' && typeof result.version === 'number') {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await updateVersion(tx, operation, result.version!, userId);
        await tx.runAsync('DELETE FROM sync_outbox WHERE operation_id = ?', operation.operation_id);
      });
      return;
    }
    if (result.status === 'missing') {
      await updateVersion(db, operation, 0);
      continue;
    }
    if (result.status === 'conflict' && result.payload && typeof result.version === 'number') {
      if (operation.entity_type === 'habit') {
        const remote = result.payload as Habit;
        if (operation.operation_type === 'create') {
          await remapHabit(db, operation.entity_id);
        } else if (remote.deleted_at) {
          await remoteDeleteWins(db, remote);
          return;
        } else {
          await updateVersion(db, operation, result.version);
        }
      } else {
        const remote = result.payload as Completion;
        if (remote.id !== operation.entity_id) await remapCompletion(db, operation.entity_id, remote.id, result.version);
        else await updateVersion(db, operation, result.version);
      }
      continue;
    }
    throw new Error('Unexpected response from cloud sync.');
  }
  throw new Error('Cloud changed during sync. Please retry.');
}

async function pullChanges(db: SQLiteDatabase, cloud: CloudClient, userId: string): Promise<number> {
  const cursorRow = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'cloud_cursor'");
  let cursor = Number(cursorRow?.value ?? '0');
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Local sync cursor is invalid.');
  let received = 0;
  for (let page = 0; page < 20; page++) {
    const changes = await workerRequest<Change[]>(cloud, 'api/sync/pull', { p_after: cursor, p_limit: 100 });
    if (!Array.isArray(changes)) throw new Error('Invalid cloud changes response.');
    if (changes.length === 0) break;
    await db.withExclusiveTransactionAsync(async (tx) => {
      if (await pendingChanges(tx) > 0) throw new Error('Local changes arrived during download; retry sync.');
      for (const change of changes) {
        if (!Number.isSafeInteger(change.revision) || change.revision <= cursor) throw new Error('Cloud changes are out of order.');
        if (change.entity_type === 'habit') {
          const habit = change.payload as Habit;
          if (habit.id !== change.entity_id || habit.owner_id !== userId) throw new Error('Invalid cloud habit.');
          const local = await tx.getFirstAsync<Pick<Habit, 'owner_id' | 'version'>>('SELECT owner_id, version FROM habits WHERE id = ?', habit.id);
          if (local?.owner_id === null) throw new Error('A local habit ID conflicts with cloud data.');
          if (local?.owner_id && local.owner_id !== userId) throw new Error('Another account owns a local habit.');
          if (!local || local.version < change.version) await upsertHabit(tx, habit);
        } else if (change.entity_type === 'completion') {
          const completion = change.payload as Completion;
          if (completion.id !== change.entity_id) throw new Error('Invalid cloud completion.');
          const local = await tx.getFirstAsync<{ version: number }>('SELECT version FROM habit_completions WHERE habit_id = ? AND completion_date = ?', completion.habit_id, completion.completion_date);
          if (!local || local.version < change.version) await upsertCompletion(tx, completion);
        } else throw new Error('Unknown cloud change.');
        cursor = change.revision;
      }
      await refreshTodaySnapshot(tx);
      await tx.runAsync("INSERT INTO sync_metadata (key, value) VALUES ('cloud_cursor', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", String(cursor));
    });
    received += changes.length;
    if (changes.length < 100) break;
  }
  return received;
}

export async function syncDatabase(db: SQLiteDatabase, cloud: CloudClient, userId: string, force = false): Promise<{ pending: number; received: number }> {
  const owner = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'cloud_owner'");
  if (owner?.value !== userId) throw new Error('Sign in with the account linked to this device.');
  for (let batch = 0; batch < 20; batch++) {
    const operations = await db.getAllAsync<Outbox>(
      `SELECT operation_id, entity_type, entity_id, operation_type, payload, retry_count
       FROM sync_outbox WHERE status = 'pending' AND (? = 1 OR next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY created_at, rowid LIMIT 50`, force ? 1 : 0, new Date().toISOString(),
    );
    if (operations.length === 0) break;
    for (const operation of operations) {
      try { await pushOne(db, cloud, userId, operation.operation_id); }
      catch (error) {
        const retryCount = operation.retry_count + 1;
        const waitSeconds = Math.min(300, 2 ** Math.min(8, retryCount));
        await db.runAsync(
          'UPDATE sync_outbox SET retry_count = ?, last_error = ?, next_attempt_at = ? WHERE operation_id = ?',
          retryCount, errorMessage(error).slice(0, 300), new Date(Date.now() + waitSeconds * 1000).toISOString(), operation.operation_id,
        );
        throw error;
      }
    }
    if (operations.length < 50) break;
  }
  const pending = await pendingChanges(db);
  if (pending > 0) return { pending, received: 0 };
  const received = await pullChanges(db, cloud, userId);
  const today = new Date().toISOString().slice(0, 10);
  const lastPing = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'activity_ping_day'");
  if (lastPing?.value !== today) {
    try {
      await workerRequest(cloud, 'api/activity', {});
      await db.runAsync("INSERT INTO sync_metadata (key, value) VALUES ('activity_ping_day', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", today);
    } catch { /* Activity metrics must never block habit sync. */ }
  }
  const profile = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'profile_name'");
  const savedProfile = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'profile_name_synced'");
  if (profile?.value && profile.value !== savedProfile?.value) {
    try {
      await cloud.updateName(profile.value);
      await db.runAsync("INSERT INTO sync_metadata (key, value) VALUES ('profile_name_synced', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", profile.value);
    } catch { /* Retry name metadata on the next successful sync. */ }
  }
  return { pending: 0, received };
}

export async function clearAccountData(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM habits');
  await Promise.all(rows.map((row) => cancelReminder(row.id)));
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.execAsync('DELETE FROM habit_completions; DELETE FROM habits; DELETE FROM daily_snapshots; DELETE FROM sync_outbox;');
    await tx.runAsync("DELETE FROM sync_metadata WHERE key IN ('cloud_owner', 'cloud_cursor', 'cloud_last_sync', 'activity_ping_day', 'profile_name', 'profile_name_synced')");
  });
}
