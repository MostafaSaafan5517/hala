-- Runs first (files run in name order) and commits, so every later test file can use these
-- helpers. They live in a `tests` schema that only ever exists in test databases; migrations
-- never create it.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Creates a signed-up user, straight in auth.users.
create or replace function tests.create_user(email text, full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (new_user_id, email, jsonb_build_object('full_name', full_name));
  return new_user_id;
end;
$$;

-- Security definer so it can read auth.users while the test acts as another role.
create or replace function tests.get_user_id(email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where auth.users.email = get_user_id.email;
$$;

-- Looks up a business id regardless of who the test is acting as, so a test can aim a query
-- at a business the current user is not allowed to see.
create or replace function tests.business_id(slug text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.businesses where businesses.slug = business_id.slug;
$$;

-- Empties the tenant tables for the rest of the transaction, so a test sees only its own
-- fixtures, not data left in a local database by the app or by Playwright runs. TRUNCATE is
-- transactional in Postgres: the test's final rollback brings everything back.
create or replace function tests.clear_tenant_data()
returns void
language sql
as $$
  truncate public.bookings, public.customers, public.closures, public.time_off,
    public.working_hours, public.staff_services, public.staff, public.services,
    public.business_members, public.businesses;
$$;

-- Makes the rest of the transaction run as that user, exactly as the API would: the
-- `authenticated` role, with auth.uid() returning their id. `tests.act_as_database()` switches
-- back. (Security invoker on purpose: Postgres forbids changing role inside a security definer.)
create or replace function tests.authenticate_as(email text)
returns void
language plpgsql
as $$
declare
  target_user_id uuid := tests.get_user_id(email);
begin
  if target_user_id is null then
    raise exception 'No test user with email %', email;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', target_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- Same, for a visitor who is not signed in (the embeddable widget's customers, for example).
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;

-- Same, as server code using the service role key.
create or replace function tests.authenticate_as_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end;
$$;

-- Back to working directly in the database, like a migration: the session's own role, with no
-- API claims left over (`reset role` alone keeps the last user's claims, so auth.uid() would
-- still return them).
create or replace function tests.act_as_database()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- The helpers themselves, so every test that relies on them can trust what they do.
begin;
select plan(8);

select tests.create_user('someone@test.local');

select tests.authenticate_as('someone@test.local');
select is(current_user, 'authenticated'::name, 'authenticate_as acts through the authenticated role');
select is(
  auth.uid(), tests.get_user_id('someone@test.local'),
  'authenticate_as makes auth.uid() that user'
);

select tests.authenticate_as_anon();
select is(current_user, 'anon'::name, 'authenticate_as_anon acts as a visitor');
select is(auth.uid(), null::uuid, 'a visitor has no user');

select tests.authenticate_as_service_role();
select is(current_user, 'service_role'::name, 'authenticate_as_service_role acts as server code');

select tests.act_as_database();
select is(current_user, 'postgres'::name, 'act_as_database goes back to the database role');
select is(auth.uid(), null::uuid, 'act_as_database leaves no user claims behind');

select throws_ok(
  $$ select tests.authenticate_as('nobody@test.local') $$,
  'P0001', 'No test user with email nobody@test.local',
  'authenticate_as refuses an unknown user instead of acting as no one'
);

select * from finish();
rollback;
