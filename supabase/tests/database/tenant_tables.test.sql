begin;
select plan(37);
select tests.clear_tenant_data();

-- Structure
select tables_are(
  'public',
  array['profiles', 'businesses', 'business_members', 'services', 'staff', 'staff_services',
    'working_hours', 'time_off', 'closures', 'audit_log', 'customers'
  ],
  'public contains exactly the expected tables'
);

select is_empty(
  $$
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  $$,
  'every table in public has RLS enabled'
);

-- The full map of table-level grants to the API roles. Some access is granted per column
-- (which columns users may change), which doesn't appear here; the RLS test files cover column
-- grants by behavior.
select table_privs_are('public', 'profiles', 'anon', array[]::text[]);
select table_privs_are('public', 'businesses', 'anon', array[]::text[]);
select table_privs_are('public', 'business_members', 'anon', array[]::text[]);
select table_privs_are('public', 'profiles', 'authenticated', array['SELECT']);
select table_privs_are('public', 'businesses', 'authenticated', array['SELECT']);
select table_privs_are(
  'public', 'business_members', 'authenticated', array['SELECT', 'INSERT', 'DELETE']
);
select table_privs_are('public', 'services', 'anon', array[]::text[]);
select table_privs_are('public', 'services', 'authenticated', array['SELECT']);
select table_privs_are('public', 'staff', 'anon', array[]::text[]);
select table_privs_are('public', 'staff', 'authenticated', array['SELECT']);
select table_privs_are('public', 'staff_services', 'anon', array[]::text[]);
select table_privs_are(
  'public', 'staff_services', 'authenticated', array['SELECT', 'INSERT', 'DELETE']
);
select table_privs_are('public', 'working_hours', 'anon', array[]::text[]);
select table_privs_are(
  'public', 'working_hours', 'authenticated', array['SELECT', 'INSERT', 'DELETE']
);
select table_privs_are('public', 'time_off', 'anon', array[]::text[]);
select table_privs_are('public', 'time_off', 'authenticated', array['SELECT', 'DELETE']);
select table_privs_are('public', 'closures', 'anon', array[]::text[]);
select table_privs_are('public', 'closures', 'authenticated', array['SELECT', 'DELETE']);
select table_privs_are('public', 'audit_log', 'anon', array[]::text[]);
select table_privs_are('public', 'audit_log', 'authenticated', array['SELECT']);
select table_privs_are('public', 'audit_log', 'service_role', array['SELECT']);
select table_privs_are('public', 'customers', 'anon', array[]::text[]);
select table_privs_are('public', 'customers', 'authenticated', array['SELECT']);

-- Fixtures: two users (profiles come from the auth trigger) and one business.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'other@example.com');

insert into public.businesses (id, name, slug, timezone)
values ('10000000-0000-0000-0000-000000000001', 'Nour Salon', 'nour-salon', 'Africa/Cairo');

-- Businesses
select throws_ok(
  $$ insert into public.businesses (name, slug, timezone) values ('Bad', 'Bad Slug', 'UTC') $$,
  '23514', null, 'slug must be lowercase words joined by dashes'
);
select throws_ok(
  $$ insert into public.businesses (name, slug, timezone) values ('Short', 'ab', 'UTC') $$,
  '23514', null, 'slug must be at least 3 characters'
);
select throws_ok(
  $$ insert into public.businesses (name, slug, timezone) values ('Copy', 'nour-salon', 'UTC') $$,
  '23505', null, 'slugs are unique'
);
select throws_ok(
  $$ insert into public.businesses (name, slug, timezone) values ('   ', 'blank-name', 'UTC') $$,
  '23514', null, 'business name cannot be blank'
);
select throws_ok(
  $$ insert into public.businesses (name, slug, timezone) values ('Mars', 'mars-spa', 'Mars/Olympus') $$,
  '23514', null, 'the time zone must be one Postgres knows'
);
-- AT TIME ZONE accepts these too, but they ignore daylight saving.
select throws_ok(
  $$ insert into public.businesses (name, slug, timezone) values ('Offset', 'offset-spa', '+02') $$,
  '23514', null, 'the time zone must be a named zone, not a fixed offset'
);
select is(
  (select default_language::text from public.businesses where slug = 'nour-salon'),
  'en',
  'a business speaks English unless it says otherwise'
);
select throws_ok(
  $$
    insert into public.businesses (name, slug, timezone, default_language)
    values ('French', 'french-spa', 'Europe/Paris', 'fr')
  $$,
  '22P02', null, 'the assistant only speaks English and Arabic'
);

-- Members
insert into public.business_members (business_id, user_id, role)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner');

select throws_ok(
  $$
    insert into public.business_members (business_id, user_id, role)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'owner')
  $$,
  '23505', null, 'a business has at most one owner'
);
select throws_ok(
  $$
    insert into public.business_members (business_id, user_id, role)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'staff')
  $$,
  '23505', null, 'a person is a member of a business only once'
);

-- Member rows are only access rows, so they go with their business, and with their user.
insert into public.business_members (business_id, user_id, role)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'staff');
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select is_empty(
  $$ select 1 from public.business_members where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  'deleting a user removes their member rows'
);

delete from public.businesses where id = '10000000-0000-0000-0000-000000000001';
select is_empty(
  $$ select 1 from public.business_members where business_id = '10000000-0000-0000-0000-000000000001' $$,
  'deleting a business removes its member rows'
);

select * from finish();
rollback;
