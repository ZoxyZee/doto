import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.stubGlobal('crypto', webcrypto);
const worker = (await import('../worker/src/index')).default;
const adminToken = 'a'.repeat(64);
const root = 'https://doto.example.workers.dev';
let native: DatabaseSync;

function d1() {
  function statement(sql: string, args: (string | number | null)[] = []) {
    return {
      bind(...values: (string | number | null)[]) { return statement(sql, values); },
      async first<T>() { return native.prepare(sql).get(...args) as T | null; },
      async all<T>() { return { results: native.prepare(sql).all(...args) as T[] }; },
      async run() { const result = native.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
    };
  }
  return {
    prepare: statement,
    async batch(statements: ReturnType<typeof statement>[]) {
      native.exec('BEGIN IMMEDIATE');
      try { const values = []; for (const item of statements) values.push(await item.run()); native.exec('COMMIT'); return values; }
      catch (error) { native.exec('ROLLBACK'); throw error; }
    },
  };
}
function env() { return { ASSETS: { fetch: async () => new Response('site') }, DB: d1(), ADMIN_TOKEN: adminToken }; }
function post(path: string, value: Record<string, unknown>, token?: string) {
  return new Request(`${root}${path}`, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, body: JSON.stringify(value) });
}
async function createUser(name = 'Tester') {
  const response = await worker.fetch(post('/api/session', { display_name: name }), env());
  expect(response.status).toBe(201);
  return response.json() as Promise<{ user_id: string; token: string }>;
}
const habitId = randomUUID();
function habit() { return { id: habitId, owner_id: null, name: 'Read', created_date: '2026-11-06', deleted_at: null, version: 0 }; }
function operation(token: string, id = randomUUID(), base = 0, value = habit()) {
  return post('/api/sync/apply', { p_operation_id: id, p_entity_type: 'habit', p_entity_id: habitId,
    p_base_version: base, p_payload: value }, token);
}

beforeEach(() => {
  native = new DatabaseSync(':memory:');
  native.exec('PRAGMA foreign_keys = ON');
  native.exec(readFileSync(resolve('worker/migrations/0001_initial.sql'), 'utf8'));
});
afterEach(() => native.close());

test('device token owns only its own changes and retries are idempotent', async () => {
  const first = await createUser('First');
  const second = await createUser('Second');
  const opId = randomUUID();
  const applied = await worker.fetch(operation(first.token, opId), env());
  expect(applied.status).toBe(200);
  const result = await applied.json() as { status: string; version: number; revision: number; payload: { owner_id: string } };
  expect(result).toMatchObject({ status: 'applied', version: 1, payload: { owner_id: first.user_id } });
  expect(await (await worker.fetch(operation(first.token, opId), env())).json()).toEqual(result);
  expect((await (await worker.fetch(post('/api/sync/pull', { p_after: 0, p_limit: 100 }, first.token), env())).json() as unknown[])).toHaveLength(1);
  expect((await (await worker.fetch(post('/api/sync/pull', { p_after: 0, p_limit: 100 }, second.token), env())).json() as unknown[])).toHaveLength(0);
  expect((await worker.fetch(operation(second.token, randomUUID(), 1), env())).status).toBe(200);
  expect((await (await worker.fetch(operation(second.token, randomUUID(), 1), env())).json() as { status: string }).status).toBe('missing');
});

test('stale edit conflicts and admin metrics require the private admin token', async () => {
  const user = await createUser();
  await worker.fetch(operation(user.token), env());
  const stale = await worker.fetch(operation(user.token, randomUUID(), 0, { ...habit(), name: 'Stale' }), env());
  expect((await stale.json() as { status: string }).status).toBe('conflict');
  const url = `${root}/api/admin/overview`;
  expect((await worker.fetch(new Request(url), env())).status).toBe(401);
  expect((await worker.fetch(new Request(url, { headers: { Authorization: `Bearer ${user.token}` } }), env())).status).toBe(403);
  const admin = await worker.fetch(new Request(url, { headers: { Authorization: `Bearer ${adminToken}` } }), env());
  expect(admin.status).toBe(200);
  const data = await admin.json() as { users: { user_id: string; display_name: string; habit_count: number }[] };
  expect(data.users).toMatchObject([{ user_id: user.user_id, display_name: 'Tester', habit_count: 1 }]);
});

test('completion changes are scoped to the owning device and keep one row per day', async () => {
  const first = await createUser('First');
  const second = await createUser('Second');
  await worker.fetch(operation(first.token), env());
  const completionId = randomUUID();
  const payload = { id: completionId, habit_id: habitId, completion_date: '2026-11-06', is_completed: 1, version: 0 };
  const request = (token: string, operationId: string, id = completionId, base = 0) => post('/api/sync/apply', {
    p_operation_id: operationId, p_entity_type: 'completion', p_entity_id: id,
    p_base_version: base, p_payload: { ...payload, id },
  }, token);
  expect((await worker.fetch(request(second.token, randomUUID()), env())).status).toBe(409);
  const applied = await worker.fetch(request(first.token, randomUUID()), env());
  expect((await applied.json() as { status: string }).status).toBe('applied');
  const collision = await worker.fetch(request(first.token, randomUUID(), randomUUID()), env());
  expect((await collision.json() as { status: string }).status).toBe('conflict');
  expect((await (await worker.fetch(post('/api/sync/pull', { p_after: 0, p_limit: 100 }, second.token), env())).json() as unknown[])).toHaveLength(0);
});
