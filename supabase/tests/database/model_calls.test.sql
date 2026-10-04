begin;
select plan(10);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Nour Salon', 'nour-salon', 'Africa/Cairo', 'ar');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Cedar Clinic', 'cedar-clinic', 'Asia/Riyadh', 'en');
select tests.act_as_database();

insert into public.business_members (business_id, user_id, role) values
  (tests.business_id('nour-salon'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('nour-salon'), tests.get_user_id('staff-a@test.local'), 'staff');

-- model_calls may hold rows from other test data; checks look only at these businesses.

select tests.authenticate_as_service_role();
select lives_ok(
  $$
    insert into public.model_calls (business_id, purpose, model, input_tokens, cost_usd, latency_ms)
    values
      (tests.business_id('nour-salon'), 'index', 'openai/text-embedding-3-small', 1200, 0.000024, 310),
      (tests.business_id('nour-salon'), 'search', 'openai/text-embedding-3-small', 9, 0.00000018, 95),
      (tests.business_id('cedar-clinic'), 'search', 'offline', 7, 0, 1)
  $$,
  'server code records model calls'
);
select throws_ok(
  $$
    insert into public.model_calls (business_id, purpose, model, input_tokens, cost_usd, latency_ms)
    values (tests.business_id('nour-salon'), 'chat', 'x', -1, 0, 0)
  $$,
  '23514', null,
  'with a known purpose and sensible numbers'
);

select tests.authenticate_as('admin-a@test.local');
select results_eq(
  $$
    select purpose, input_tokens, cost_usd from public.model_calls
    where business_id = tests.business_id('nour-salon') order by id
  $$,
  $$ values ('index', 1200, 0.000024::numeric), ('search', 9, 0.00000018) $$,
  'owners and admins see their business''s usage'
);
select tests.authenticate_as('staff-a@test.local');
select is_empty($$ select 1 from public.model_calls $$, 'staff do not');
select tests.authenticate_as('owner-b@test.local');
select is_empty(
  $$ select 1 from public.model_calls where business_id = tests.business_id('nour-salon') $$,
  'other businesses do not'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$
    insert into public.model_calls (business_id, purpose, model, input_tokens, cost_usd, latency_ms)
    values (tests.business_id('nour-salon'), 'search', 'offline', 0, 0, 0)
  $$,
  '42501', 'permission denied for table model_calls',
  'users cannot record usage'
);
select tests.authenticate_as_service_role();
select throws_ok(
  $$ update public.model_calls set cost_usd = 0 where business_id = tests.business_id('nour-salon') $$,
  '42501', 'permission denied for table model_calls',
  'server code cannot change a record'
);
select tests.act_as_database();
select throws_ok(
  $$ update public.model_calls set cost_usd = 0 where business_id = tests.business_id('nour-salon') $$,
  'P0001', 'model_calls is append-only: its rows can''t be changed or deleted',
  'nor can the database itself'
);
select throws_ok(
  $$ delete from public.model_calls where business_id = tests.business_id('nour-salon') $$,
  'P0001', 'model_calls is append-only: its rows can''t be changed or deleted',
  'or delete one'
);
select throws_ok(
  $$ truncate public.model_calls $$,
  'P0001', 'model_calls is append-only: its rows can''t be changed or deleted',
  'or empty the table'
);

select * from finish();
rollback;
