import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { expect, test } from 'vitest';

const firstUser = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondUser = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const habitId = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';

test('Supabase migration enforces ownership, idempotency, versions and pull cursors', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create role anon;
      create role authenticated;
      insert into auth.users(id) values ('${firstUser}'), ('${secondUser}');
    `);
    await pg.exec(readFileSync(resolve('supabase/migrations/20261106000000_doto_sync.sql'), 'utf8'));
    await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${firstUser}', false);`);

    const payload = {
      id: habitId, owner_id: secondUser, name: 'Read 10 minutes', description: null,
      icon: 'book-outline', color: '#8091B5', created_at: '2026-11-06T00:00:00.000Z',
      updated_at: '2026-11-06T00:00:00.000Z', archived_at: null, deleted_at: null,
      reminder_enabled: 0, reminder_time: null, version: 0, local_revision: 1,
      created_date: '2026-11-06', created_timezone: 'Asia/Kolkata',
    };
    const apply = () => pg.query<{ result: { status: string; version: number; revision: number; payload: { owner_id: string } } }>(
      'select public.doto_apply_operation($1::uuid, $2::text, $3::uuid, $4::integer, $5::jsonb) as result',
      [operationId, 'habit', habitId, 0, JSON.stringify(payload)],
    );
    const first = (await apply()).rows[0]!.result;
    expect(first).toMatchObject({ status: 'applied', version: 1, revision: 1 });
    expect(first.payload.owner_id).toBe(firstUser);
    expect((await apply()).rows[0]!.result).toEqual(first);

    const stale = await pg.query<{ result: { status: string; version: number } }>(
      'select public.doto_apply_operation($1::uuid, $2::text, $3::uuid, $4::integer, $5::jsonb) as result',
      ['33333333-3333-4333-8333-333333333333', 'habit', habitId, 0, JSON.stringify({ ...payload, name: 'Stale edit' })],
    );
    expect(stale.rows[0]!.result).toMatchObject({ status: 'conflict', version: 1 });
    const completionId = '55555555-5555-4555-8555-555555555555';
    const completion = {
      id: completionId, habit_id: habitId, completion_date: '2026-11-06',
      completion_timezone: 'Asia/Kolkata', is_completed: 1,
      created_at: '2026-11-06T01:00:00.000Z', updated_at: '2026-11-06T01:00:00.000Z',
      version: 0, local_revision: 1,
    };
    const completed = await pg.query<{ result: { status: string; revision: number } }>(
      'select public.doto_apply_operation($1::uuid, $2::text, $3::uuid, $4::integer, $5::jsonb) as result',
      ['66666666-6666-4666-8666-666666666666', 'completion', completionId, 0, JSON.stringify(completion)],
    );
    expect(completed.rows[0]!.result).toMatchObject({ status: 'applied', revision: 2 });
    const secondCompletion = await pg.query<{ result: { status: string; payload: { id: string } } }>(
      'select public.doto_apply_operation($1::uuid, $2::text, $3::uuid, $4::integer, $5::jsonb) as result',
      ['77777777-7777-4777-8777-777777777777', 'completion', '88888888-8888-4888-8888-888888888888', 0,
        JSON.stringify({ ...completion, id: '88888888-8888-4888-8888-888888888888' })],
    );
    expect(secondCompletion.rows[0]!.result).toMatchObject({ status: 'conflict', payload: { id: completionId } });
    const changes = await pg.query<{ revision: number }>('select revision from public.doto_pull_changes(0, 100)');
    expect(changes.rows.map((row) => row.revision)).toEqual([1, 2]);
    expect((await pg.query('select revision from public.doto_pull_changes(2, 100)')).rows).toHaveLength(0);

    await pg.exec(`select set_config('request.jwt.claim.sub', '${secondUser}', false);`);
    expect((await pg.query('select id from public.doto_habits')).rows).toHaveLength(0);
    expect((await pg.query('select revision from public.doto_pull_changes(0, 100)')).rows).toHaveLength(0);
    await expect(pg.query(
      'insert into public.doto_habits(owner_id, id, payload, version) values ($1::uuid, $2::uuid, $3::jsonb, 1)',
      [firstUser, '44444444-4444-4444-8444-444444444444', JSON.stringify(payload)],
    )).rejects.toThrow();
  } finally { await pg.close(); }
});
