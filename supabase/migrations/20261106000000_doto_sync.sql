-- Run in a Supabase project before enabling cloud sync in the app.
-- All client writes go through doto_apply_operation. The authenticated user,
-- not the mobile payload, determines ownership.

create table public.doto_habits (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  payload jsonb not null,
  version integer not null check (version > 0),
  primary key (owner_id, id)
);

create table public.doto_completions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  habit_id uuid not null,
  completion_date date not null,
  payload jsonb not null,
  version integer not null check (version > 0),
  primary key (owner_id, id),
  unique (owner_id, habit_id, completion_date),
  foreign key (owner_id, habit_id) references public.doto_habits(owner_id, id)
);

create table public.doto_sync_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0)
);

create table public.doto_sync_changes (
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  entity_type text not null check (entity_type in ('habit', 'completion')),
  entity_id uuid not null,
  payload jsonb not null,
  version integer not null,
  primary key (owner_id, revision)
);

create table public.doto_operation_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  result jsonb not null,
  primary key (owner_id, operation_id)
);

create index doto_changes_entity_idx on public.doto_sync_changes(owner_id, entity_type, entity_id);

alter table public.doto_habits enable row level security;
alter table public.doto_completions enable row level security;
alter table public.doto_sync_state enable row level security;
alter table public.doto_sync_changes enable row level security;
alter table public.doto_operation_receipts enable row level security;

revoke all on public.doto_habits, public.doto_completions, public.doto_sync_state,
  public.doto_sync_changes, public.doto_operation_receipts from public, anon, authenticated;
grant select on public.doto_habits, public.doto_completions, public.doto_sync_changes to authenticated;

create policy doto_habits_owner_read on public.doto_habits for select to authenticated
  using (owner_id = (select auth.uid()));
create policy doto_completions_owner_read on public.doto_completions for select to authenticated
  using (owner_id = (select auth.uid()));
create policy doto_changes_owner_read on public.doto_sync_changes for select to authenticated
  using (owner_id = (select auth.uid()));

create function public.doto_apply_operation(
  p_operation_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_base_version integer,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_current jsonb;
  v_version integer;
  v_revision bigint;
  v_payload jsonb;
  v_result jsonb;
  v_habit_id uuid;
  v_date date;
  v_canonical_id uuid;
begin
  if v_owner is null then
    raise exception 'Sign in before syncing.' using errcode = '28000';
  end if;
  if p_operation_id is null or p_entity_id is null or p_base_version is null or p_base_version < 0
     or coalesce(p_entity_type, '') not in ('habit', 'completion')
     or jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload->>'id' is distinct from p_entity_id::text
     or octet_length(p_payload::text) > 8192 then
    raise exception 'Invalid sync operation.' using errcode = '22023';
  end if;

  if p_entity_type = 'habit' then
    if length(trim(coalesce(p_payload->>'name', ''))) not between 1 and 80
       or length(coalesce(p_payload->>'description', '')) > 300
       or coalesce(p_payload->>'icon', '') not in ('sparkles', 'book-outline', 'fitness-outline', 'code-slash', 'leaf-outline', 'water-outline')
       or coalesce(p_payload->>'color', '') not in ('#E98651', '#668D82', '#8091B5', '#B49462', '#A0809C')
       or coalesce(p_payload->>'created_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or coalesce(p_payload->>'created_timezone', '') = ''
       or coalesce(p_payload->>'reminder_enabled', '') not in ('0', '1')
       or (p_payload->>'reminder_enabled' = '1' and coalesce(p_payload->>'reminder_time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
      raise exception 'Invalid habit payload.' using errcode = '22023';
    end if;
    perform (p_payload->>'created_date')::date;
  else
    v_habit_id := (p_payload->>'habit_id')::uuid;
    v_date := (p_payload->>'completion_date')::date;
    if coalesce(p_payload->>'completion_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or coalesce(p_payload->>'completion_timezone', '') = ''
       or coalesce(p_payload->>'is_completed', '') not in ('0', '1') then
      raise exception 'Invalid completion payload.' using errcode = '22023';
    end if;
  end if;

  -- Serializes writes per account. Revisions then match transaction commit order.
  insert into public.doto_sync_state(owner_id) values (v_owner) on conflict do nothing;
  select revision into v_revision from public.doto_sync_state
    where owner_id = v_owner for update;

  select result into v_result from public.doto_operation_receipts
    where owner_id = v_owner and operation_id = p_operation_id;
  if found then
    return v_result;
  end if;

  if p_entity_type = 'habit' then
    select payload, version into v_current, v_version from public.doto_habits
      where owner_id = v_owner and id = p_entity_id;
  else
    select id, payload, version into v_canonical_id, v_current, v_version
      from public.doto_completions where owner_id = v_owner
      and habit_id = v_habit_id and completion_date = v_date;
    if not exists (select 1 from public.doto_habits
                   where owner_id = v_owner and id = v_habit_id) then
      raise exception 'Sync the habit before its completion.' using errcode = '23503';
    end if;
  end if;

  if v_version is not null and (v_version <> p_base_version
      or (p_entity_type = 'completion' and v_canonical_id <> p_entity_id)) then
    return jsonb_build_object('status', 'conflict', 'payload', v_current, 'version', v_version);
  end if;
  if v_version is null and p_base_version <> 0 then
    return jsonb_build_object('status', 'missing');
  end if;

  v_version := coalesce(v_version, 0) + 1;
  v_payload := p_payload || jsonb_build_object('owner_id', v_owner, 'version', v_version);
  if p_entity_type = 'habit' then
    insert into public.doto_habits(owner_id, id, payload, version)
      values (v_owner, p_entity_id, v_payload, v_version)
      on conflict (owner_id, id) do update
      set payload = excluded.payload, version = excluded.version;
  else
    insert into public.doto_completions(owner_id, id, habit_id, completion_date, payload, version)
      values (v_owner, p_entity_id, v_habit_id, v_date, v_payload, v_version)
      on conflict (owner_id, id) do update
      set payload = excluded.payload, version = excluded.version;
  end if;

  v_revision := v_revision + 1;
  update public.doto_sync_state set revision = v_revision where owner_id = v_owner;
  insert into public.doto_sync_changes(owner_id, revision, entity_type, entity_id, payload, version)
    values (v_owner, v_revision, p_entity_type, p_entity_id, v_payload, v_version);
  v_result := jsonb_build_object('status', 'applied', 'payload', v_payload,
    'version', v_version, 'revision', v_revision);
  insert into public.doto_operation_receipts(owner_id, operation_id, result)
    values (v_owner, p_operation_id, v_result);
  return v_result;
end;
$$;

create function public.doto_pull_changes(p_after bigint default 0, p_limit integer default 100)
returns table(revision bigint, entity_type text, entity_id uuid, payload jsonb, version integer)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'Sign in before syncing.' using errcode = '28000';
  end if;
  return query select c.revision, c.entity_type, c.entity_id, c.payload, c.version
    from public.doto_sync_changes c where c.owner_id = v_owner and c.revision > greatest(0, p_after)
    order by c.revision limit least(100, greatest(1, p_limit));
end;
$$;

revoke execute on function public.doto_apply_operation(uuid, text, uuid, integer, jsonb) from public, anon;
revoke execute on function public.doto_pull_changes(bigint, integer) from public, anon;
grant execute on function public.doto_apply_operation(uuid, text, uuid, integer, jsonb) to authenticated;
grant execute on function public.doto_pull_changes(bigint, integer) to authenticated;
