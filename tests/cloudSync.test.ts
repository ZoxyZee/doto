import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { CloudClient } from '../src/cloud/client';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, expect, test, vi } from 'vitest';
import { migrateDatabase } from '../src/database/migrations';
import type { Habit } from '../src/types/habit';

vi.mock('expo-crypto', () => ({ randomUUID }));
vi.mock('@/notifications/reminders', () => ({ cancelReminder: async () => undefined }));
vi.mock('@/cloud/api', () => ({ workerRequest: async (cloud: FakeCloud, path: string, payload: Record<string, unknown>) => {
  if (path === 'api/activity') return { ok: true };
  const name = path === 'api/sync/apply' ? 'doto_apply_operation' : 'doto_pull_changes';
  const { data, error } = await cloud.rpc(name, payload);
  if (error) throw error;
  return data;
} }));

const { clearAccountData, pendingChanges, syncDatabase } = await import('../src/cloud/sync');
const opened: DatabaseSync[] = [];
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function localDb() {
  const native = new DatabaseSync(':memory:');
  opened.push(native);
  const adapter = {
    execAsync: async (sql: string) => { native.exec(sql); },
    getFirstAsync: async <T>(sql: string, ...args: (string | number | null)[]) =>
      (native.prepare(sql).get(...args) as T | undefined) ?? null,
    getAllAsync: async <T>(sql: string, ...args: (string | number | null)[]) =>
      native.prepare(sql).all(...args) as T[],
    runAsync: async (sql: string, ...args: (string | number | null)[]) =>
      native.prepare(sql).run(...args),
    withExclusiveTransactionAsync: async <T>(fn: (tx: SQLiteDatabase) => Promise<T>) => {
      native.exec('BEGIN IMMEDIATE');
      try { const result = await fn(adapter as unknown as SQLiteDatabase); native.exec('COMMIT'); return result; }
      catch (error) { native.exec('ROLLBACK'); throw error; }
    },
  } as unknown as SQLiteDatabase;
  await migrateDatabase(adapter);
  await adapter.runAsync("INSERT INTO sync_metadata (key, value) VALUES ('cloud_owner', ?)", owner);
  return adapter;
}

function habit(id = randomUUID()): Habit {
  return {
    id, owner_id: null, name: 'Read', description: null, icon: 'book-outline', color: '#8091B5',
    created_at: '2026-11-06T00:00:00.000Z', updated_at: '2026-11-06T00:00:00.000Z',
    archived_at: null, deleted_at: null, reminder_enabled: 0, reminder_time: null,
    reminder_interval_minutes: null, reminder_end_time: null,
    version: 0, local_revision: 1, created_date: '2026-11-06', created_timezone: 'Asia/Kolkata',
  };
}

async function queueHabit(db: SQLiteDatabase, value: Habit, operationType: string) {
  if (operationType === 'create') {
    await db.runAsync(
      `INSERT INTO habits (id, owner_id, name, description, icon, color, created_at, updated_at,
       archived_at, deleted_at, reminder_enabled, reminder_time, version, local_revision, created_date, created_timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      value.id, value.owner_id, value.name, value.description, value.icon, value.color,
      value.created_at, value.updated_at, value.archived_at, value.deleted_at,
      value.reminder_enabled, value.reminder_time, value.version, value.local_revision,
      value.created_date, value.created_timezone,
    );
  } else {
    await db.runAsync('UPDATE habits SET name = ?, local_revision = local_revision + 1 WHERE id = ?', value.name, value.id);
  }
  await db.runAsync(
    `INSERT INTO sync_outbox (operation_id, entity_type, entity_id, operation_type, payload, created_at)
     VALUES (?, 'habit', ?, ?, ?, ?)`, randomUUID(), value.id, operationType,
    JSON.stringify(value), new Date().toISOString(),
  );
}

class FakeCloud {
  updateName = async () => undefined;
  rows = new Map<string, Habit>();
  completions = new Map<string, { id: string; habit_id: string; completion_date: string; is_completed: number; version: number }>();
  receipts = new Map<string, unknown>();
  changes: { revision: number; entity_type: 'habit' | 'completion'; entity_id: string; payload: Record<string, unknown>; version: number }[] = [];
  failAfterCommitOnce = false;

  async rpc(name: string, args: Record<string, unknown>) {
    if (name === 'doto_pull_changes') {
      return { data: this.changes.filter((change) => change.revision > Number(args.p_after)).slice(0, Number(args.p_limit)), error: null };
    }
    const operationId = String(args.p_operation_id);
    let result = this.receipts.get(operationId);
    if (!result) {
      const id = String(args.p_entity_id);
      if (args.p_entity_type === 'completion') {
        const incoming = args.p_payload as { id: string; habit_id: string; completion_date: string; is_completed: number };
        const key = `${incoming.habit_id}:${incoming.completion_date}`;
        const previous = this.completions.get(key);
        if (previous && (previous.version !== args.p_base_version || previous.id !== id)) {
          return { data: { status: 'conflict', payload: previous, version: previous.version }, error: null };
        }
        const next = { ...incoming, version: (previous?.version ?? 0) + 1 };
        this.completions.set(key, next);
        this.changes.push({ revision: this.changes.length + 1, entity_type: 'completion', entity_id: id, payload: next, version: next.version });
        result = { status: 'applied', payload: next, version: next.version, revision: this.changes.length };
        this.receipts.set(operationId, result);
        return { data: result, error: null };
      }
      const previous = this.rows.get(id);
      if (previous && previous.version !== args.p_base_version) {
        return { data: { status: 'conflict', payload: previous, version: previous.version }, error: null };
      }
      const next = { ...(args.p_payload as Habit), owner_id: owner, version: (previous?.version ?? 0) + 1 };
      this.rows.set(id, next);
      this.changes.push({ revision: this.changes.length + 1, entity_type: 'habit', entity_id: id, payload: next, version: next.version });
      result = { status: 'applied', payload: next, version: next.version, revision: this.changes.length };
      this.receipts.set(operationId, result);
    }
    if (this.failAfterCommitOnce) {
      this.failAfterCommitOnce = false;
      return { data: null, error: new Error('Connection dropped after commit') };
    }
    return { data: result, error: null };
  }
}

afterEach(() => { for (const native of opened.splice(0)) native.close(); });

test('uploads a guest habit, then downloads it on another device', async () => {
  const first = await localDb();
  const second = await localDb();
  const cloud = new FakeCloud();
  const value = { ...habit(), reminder_enabled: 1, reminder_time: '08:30', reminder_interval_minutes: 120, reminder_end_time: '18:30' };
  await queueHabit(first, value, 'create');

  expect(await syncDatabase(first, cloud as unknown as CloudClient, owner)).toEqual({ pending: 0, received: 1 });
  expect(await pendingChanges(first)).toBe(0);
  expect((await first.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ?', value.id))?.owner_id).toBe(owner);
  expect(await syncDatabase(second, cloud as unknown as CloudClient, owner)).toEqual({ pending: 0, received: 1 });
  expect(await second.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ?', value.id))
    .toMatchObject({ name: 'Read', reminder_interval_minutes: 120, reminder_end_time: '18:30' });
});

test('retries an acknowledged operation without duplicating it', async () => {
  const db = await localDb();
  const cloud = new FakeCloud();
  const value = habit();
  await queueHabit(db, value, 'create');
  cloud.failAfterCommitOnce = true;

  await expect(syncDatabase(db, cloud as unknown as CloudClient, owner)).rejects.toThrow('Connection dropped');
  expect(await pendingChanges(db)).toBe(1);
  expect(cloud.changes).toHaveLength(1);
  expect(await syncDatabase(db, cloud as unknown as CloudClient, owner, true)).toEqual({ pending: 0, received: 1 });
  expect(cloud.changes).toHaveLength(1);
});

test('rebases a local edit on a newer cloud version', async () => {
  const db = await localDb();
  const cloud = new FakeCloud();
  const value = habit();
  await queueHabit(db, value, 'create');
  await syncDatabase(db, cloud as unknown as CloudClient, owner);
  const localEdit = { ...value, name: 'Read 20 minutes', version: 1, local_revision: 2 };
  await queueHabit(db, localEdit, 'update');
  const remote = { ...cloud.rows.get(value.id)!, name: 'Read 5 minutes', version: 2 };
  cloud.rows.set(value.id, remote);
  cloud.changes.push({ revision: 2, entity_type: 'habit', entity_id: value.id, payload: remote, version: 2 });

  expect(await syncDatabase(db, cloud as unknown as CloudClient, owner)).toEqual({ pending: 0, received: 2 });
  expect(cloud.rows.get(value.id)?.name).toBe('Read 20 minutes');
  expect((await db.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ?', value.id))?.version).toBe(3);
});

test('preserves both habits when a guest ID collides with cloud data', async () => {
  const db = await localDb();
  const cloud = new FakeCloud();
  const value = habit();
  await queueHabit(db, value, 'create');
  const remote = { ...value, owner_id: owner, name: 'Existing cloud habit', version: 1 };
  cloud.rows.set(value.id, remote);
  cloud.changes.push({ revision: 1, entity_type: 'habit', entity_id: value.id, payload: remote, version: 1 });

  expect(await syncDatabase(db, cloud as unknown as CloudClient, owner)).toEqual({ pending: 0, received: 2 });
  const rows = await db.getAllAsync<Habit>('SELECT * FROM habits ORDER BY name');
  expect(rows.map((row) => row.name)).toEqual(['Existing cloud habit', 'Read']);
  expect(new Set(rows.map((row) => row.id)).size).toBe(2);
});

test('a remote deletion wins over an unsynced local edit', async () => {
  const db = await localDb();
  const cloud = new FakeCloud();
  const value = habit();
  await queueHabit(db, value, 'create');
  await syncDatabase(db, cloud as unknown as CloudClient, owner);
  await queueHabit(db, { ...value, name: 'Local edit' }, 'update');
  const remote = { ...cloud.rows.get(value.id)!, deleted_at: '2026-11-06T01:00:00.000Z', version: 2 };
  cloud.rows.set(value.id, remote);
  cloud.changes.push({ revision: 2, entity_type: 'habit', entity_id: value.id, payload: remote, version: 2 });

  await syncDatabase(db, cloud as unknown as CloudClient, owner);
  expect(await pendingChanges(db)).toBe(0);
  expect((await db.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ?', value.id))?.deleted_at).toBe(remote.deleted_at);
});

test('completion conflict adopts the cloud ID and keeps the latest local choice', async () => {
  const db = await localDb();
  const cloud = new FakeCloud();
  const value = habit();
  await queueHabit(db, value, 'create');
  await syncDatabase(db, cloud as unknown as CloudClient, owner);
  const localId = randomUUID();
  const remoteId = randomUUID();
  const date = '2026-11-06';
  const completion = {
    id: localId, habit_id: value.id, completion_date: date, completion_timezone: 'Asia/Kolkata',
    is_completed: 1, created_at: '2026-11-06T01:00:00.000Z', updated_at: '2026-11-06T01:00:00.000Z',
    version: 0, local_revision: 1,
  };
  await db.runAsync(
    `INSERT INTO habit_completions (id, habit_id, completion_date, completion_timezone,
     is_completed, created_at, updated_at, version, local_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    completion.id, completion.habit_id, completion.completion_date, completion.completion_timezone,
    completion.is_completed, completion.created_at, completion.updated_at, completion.version, completion.local_revision,
  );
  await db.runAsync(
    `INSERT INTO sync_outbox (operation_id, entity_type, entity_id, operation_type, payload, created_at)
     VALUES (?, 'completion', ?, 'set', ?, ?)`, randomUUID(), localId, JSON.stringify(completion), new Date().toISOString(),
  );
  const remote = { ...completion, id: remoteId, is_completed: 0, version: 1 };
  cloud.completions.set(`${value.id}:${date}`, remote);
  cloud.changes.push({ revision: 2, entity_type: 'completion', entity_id: remoteId, payload: remote, version: 1 });

  await syncDatabase(db, cloud as unknown as CloudClient, owner);
  const merged = await db.getFirstAsync<typeof completion>('SELECT * FROM habit_completions WHERE habit_id = ? AND completion_date = ?', value.id, date);
  expect(merged?.id).toBe(remoteId);
  expect(merged?.is_completed).toBe(1);
  expect(merged?.version).toBe(2);
  expect(await pendingChanges(db)).toBe(0);
});

test('sign-out cleanup isolates account data and keeps the appearance preference', async () => {
  const db = await localDb();
  const value = habit();
  await queueHabit(db, value, 'create');
  await db.runAsync("INSERT INTO sync_metadata (key, value) VALUES ('theme_mode', 'dark')");
  await db.runAsync("INSERT INTO sync_metadata (key, value) VALUES ('cloud_cursor', '4')");

  await clearAccountData(db);
  expect(await db.getFirstAsync('SELECT id FROM habits')).toBeNull();
  expect(await pendingChanges(db)).toBe(0);
  expect((await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'theme_mode'"))?.value).toBe('dark');
  expect(await db.getFirstAsync("SELECT value FROM sync_metadata WHERE key = 'cloud_owner'")).toBeNull();
});
