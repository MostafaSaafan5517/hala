-- An append-only history of every change to a business's setup: who made it, to which row, what
-- changed (before and after), and when. Triggers write it, never application code, so no code
-- path can forget to log; once written, nobody can change or delete an entry. The assistant's
-- tool calls will get their own log in the same style.

create table public.audit_log (
  id bigint generated always as identity primary key,
  -- No foreign keys: the history must outlive the rows it describes.
  business_id uuid not null,
  -- Who made the change: a signed-in user, other server code (the service role), or someone
  -- working in the database directly.
  actor text not null check (actor in ('user', 'server', 'database')),
  -- The signed-in user behind the change, when there is one.
  actor_user_id uuid,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  -- For updates: the columns whose values changed.
  changed_columns text[] not null default '{}',
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_business_id_id on public.audit_log (business_id, id desc);

-- Append-only, in two layers. No API role (not even the service role) may insert, update or
-- delete; only the trigger function below writes, as the table's owner. And for the owner
-- itself, updates, deletes and truncation are rejected by triggers.
alter table public.audit_log enable row level security;
revoke all on public.audit_log from service_role;
grant select on public.audit_log to service_role, authenticated;

create policy "owners and admins see their business's history"
  on public.audit_log for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'));

create function private.reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only: its rows can''t be changed or deleted', tg_table_name;
end;
$$;

create trigger audit_log_is_append_only
  before update or delete on public.audit_log
  for each row execute function private.reject_change();
create trigger audit_log_cannot_be_truncated
  before truncate on public.audit_log
  for each statement execute function private.reject_change();

-- Who is making the current change. A signed-in user's request is always "user" (they can't
-- claim to be anything else); the service role is "server"; anything without an API role
-- (migrations, psql) is "database".
create function private.current_actor()
returns text
language sql
stable
set search_path = ''
as $$
  select case auth.role()
    when 'authenticated' then 'user'
    when 'service_role' then 'server'
    else 'database'
  end;
$$;

-- The audit trigger. Its one argument names the column that identifies a row (business_members
-- has no id of its own). Security definer: it writes as the table's owner, the only role allowed
-- to insert into audit_log.
create function private.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changed text[] := '{}';
begin
  if tg_op <> 'INSERT' then
    v_old := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    v_new := to_jsonb(new);
  end if;
  v_row := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(changed.key order by changed.key), '{}')
    into v_changed
    from jsonb_each(v_new) as changed
    where changed.value is distinct from v_old -> changed.key;
    -- An update that changes nothing isn't history.
    if cardinality(v_changed) = 0 then
      return null;
    end if;
  end if;

  insert into public.audit_log (
    business_id, actor, actor_user_id, table_name, record_id, action, changed_columns,
    old_data, new_data
  )
  values (
    (v_row ->> case when tg_table_name = 'businesses' then 'id' else 'business_id' end)::uuid,
    private.current_actor(),
    auth.uid(),
    tg_table_name,
    (v_row ->> tg_argv[0])::uuid,
    lower(tg_op),
    v_changed,
    v_old,
    v_new
  );
  return null;
end;
$$;

create trigger record_audit_log
  after insert or update or delete on public.businesses
  for each row execute function private.record_audit_log('id');
create trigger record_audit_log
  after insert or update or delete on public.business_members
  for each row execute function private.record_audit_log('user_id');
create trigger record_audit_log
  after insert or update or delete on public.services
  for each row execute function private.record_audit_log('id');
create trigger record_audit_log
  after insert or update or delete on public.staff
  for each row execute function private.record_audit_log('id');
-- A link row is identified by its staff member: "Layla now performs Colour".
create trigger record_audit_log
  after insert or update or delete on public.staff_services
  for each row execute function private.record_audit_log('staff_id');
create trigger record_audit_log
  after insert or update or delete on public.working_hours
  for each row execute function private.record_audit_log('id');
create trigger record_audit_log
  after insert or update or delete on public.time_off
  for each row execute function private.record_audit_log('id');
create trigger record_audit_log
  after insert or update or delete on public.closures
  for each row execute function private.record_audit_log('id');
