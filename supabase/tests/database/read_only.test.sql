begin;
select plan(12);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('demo-a@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Nour Salon', 'nour-salon', 'Asia/Riyadh', 'en');
insert into public.services (business_id, name_en, duration_minutes, price, currency)
values (tests.business_id('nour-salon'), 'Haircut', 45, 12000, 'SAR');
select tests.act_as_database();
insert into public.business_members (business_id, user_id, role) values
  (tests.business_id('nour-salon'), tests.get_user_id('demo-a@test.local'), 'admin');
insert into public.conversations (id, business_id, channel, visitor_token_hash, visitor_hash) values
  ('72000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'widget', repeat('1', 64), repeat('f', 64));

-- The demo account: an admin whose app_metadata marks it read-only, as the admin API sets it.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', tests.get_user_id('demo-a@test.local'),
    'role', 'authenticated',
    'app_metadata', json_build_object('read_only', true)
  )::text,
  true
);
select set_config('role', 'authenticated', true);

select results_eq(
  $$ select name_en from public.services where business_id = tests.business_id('nour-salon') $$,
  $$ values ('Haircut') $$,
  'a read-only account sees what its role allows'
);
select throws_ok(
  $$
    insert into public.services (business_id, name_en, duration_minutes, price, currency)
    values (tests.business_id('nour-salon'), 'Shave', 30, 5000, 'SAR')
  $$,
  'HB010', 'This demo account is read-only',
  'but can''t add anything'
);
select throws_ok(
  $$ update public.businesses set name = 'Defaced' where slug = 'nour-salon' $$,
  'HB010', 'This demo account is read-only',
  'or change anything'
);
select throws_ok(
  $$ select public.create_business('Another', 'another-business', 'Asia/Riyadh', 'en') $$,
  'HB010', 'This demo account is read-only',
  'or create a business, though create_business runs with its owner''s rights'
);
select throws_ok(
  $$
    select public.book_appointment(
      target_service_id => (select id from public.services where name_en = 'Haircut'),
      requested_start => now() + interval '2 days',
      customer_name => 'Mona Adel',
      customer_phone => '+966501234567',
      idempotency_key => 'read-only-test-booking'
    )
  $$,
  'HB010', 'This demo account is read-only',
  'or book'
);
select throws_ok(
  $$
    insert into public.closures (business_id, starts_on, ends_on, reason)
    values (tests.business_id('nour-salon'), current_date + 1, current_date + 1, 'Closed for the demo')
  $$,
  'HB010', 'This demo account is read-only',
  'or close the business for a day'
);
select throws_ok(
  $$ select public.take_over_conversation('72000000-0000-0000-0000-000000000001') $$,
  'HB010', 'This demo account is read-only',
  'or take a conversation over'
);

select tests.act_as_database();
select results_eq(
  $$
    select (select name from public.businesses where slug = 'nour-salon'),
      (select count(*)::integer from public.services),
      (select count(*)::integer from public.businesses),
      (select count(*)::integer from public.bookings),
      (select status::text from public.conversations where id = '72000000-0000-0000-0000-000000000001')
  $$,
  $$ values ('Nour Salon', 1, 1, 0, 'open') $$,
  'none of it changed anything'
);

select tests.authenticate_as('owner-a@test.local');
select lives_ok(
  $$
    insert into public.services (business_id, name_en, duration_minutes, price, currency)
    values (tests.business_id('nour-salon'), 'Shave', 30, 5000, 'SAR')
  $$,
  'accounts without the flag write as before'
);
select tests.authenticate_as_service_role();
select lives_ok(
  $$
    insert into public.conversations (business_id, channel, visitor_token_hash, visitor_hash)
    values (tests.business_id('nour-salon'), 'widget', repeat('2', 64), repeat('e', 64))
  $$,
  'and so does server code, so the assistant still works for a demo visitor'
);
select tests.act_as_database();
select lives_ok(
  $$ update public.businesses set name = 'Nour Salon' where slug = 'nour-salon' $$,
  'as do migrations and seeds'
);

select is_empty(
  $$
    select table_name::text
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and not exists (
        select 1
        from pg_trigger trigger
        join pg_class relation on relation.oid = trigger.tgrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public'
          and relation.relname = table_name
          and trigger.tgname = 'read_only_accounts_cannot_write'
      )
  $$,
  'every table has the read-only guard (a new table needs it too)'
);

select * from finish();
rollback;
