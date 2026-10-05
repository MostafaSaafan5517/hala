begin;
select plan(10);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');

-- Riyadh is UTC+3 all year: local midnight on 2 March is 21:00 UTC on 1 March.
select tests.authenticate_as('owner-a@test.local');
select public.create_business('Nour Salon', 'nour-salon', 'Asia/Riyadh', 'ar');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Palm Clinic', 'palm-clinic', 'Asia/Riyadh', 'en');
select tests.act_as_database();
insert into public.business_members (business_id, user_id, role) values
  (tests.business_id('nour-salon'), tests.get_user_id('staff-a@test.local'), 'staff');

select tests.authenticate_as_service_role();
insert into public.model_calls
  (business_id, purpose, model, input_tokens, output_tokens, cost_usd, latency_ms, error, created_at)
values
  -- 1 March, local: just after midnight, just before the next one, and a search.
  (tests.business_id('nour-salon'), 'chat', 'anthropic/claude-haiku-4.5', 1000, 100, 0.0015, 100, null, '2026-02-28 21:30+00'),
  (tests.business_id('nour-salon'), 'chat', 'anthropic/claude-haiku-4.5', 3000, 300, 0.0045, 300, null, '2026-03-01 20:59+00'),
  (tests.business_id('nour-salon'), 'search', 'openai/text-embedding-3-small', 20, 0, 0.0000004, 50, null, '2026-03-01 10:00+00'),
  -- 2 March, local: from local midnight, and a call that failed.
  (tests.business_id('nour-salon'), 'chat', 'anthropic/claude-haiku-4.5', 2000, 200, 0.003, 500, null, '2026-03-01 21:00+00'),
  (tests.business_id('nour-salon'), 'chat', 'anthropic/claude-haiku-4.5', 500, 0, 0.0005, 9000, 'APICallError', '2026-03-02 08:00+00'),
  -- Another business, on 1 March.
  (tests.business_id('palm-clinic'), 'chat', 'anthropic/claude-sonnet-5.5', 9000, 900, 0.027, 700, null, '2026-03-01 09:00+00');

insert into public.conversations (business_id, channel, visitor_token_hash, visitor_hash, created_at) values
  (tests.business_id('nour-salon'), 'widget', repeat('1', 64), repeat('f', 64), '2026-03-01 09:00+00'),
  (tests.business_id('nour-salon'), 'widget', repeat('2', 64), repeat('f', 64), '2026-03-01 21:15+00'),
  (tests.business_id('palm-clinic'), 'widget', repeat('3', 64), repeat('e', 64), '2026-03-01 09:00+00');
insert into public.conversations (business_id, channel, created_at) values
  (tests.business_id('nour-salon'), 'test', '2026-03-01 09:00+00');

insert into public.tool_calls (business_id, conversation_id, tool_call_id, tool_name, input, output, status, created_at) values
  (tests.business_id('nour-salon'), gen_random_uuid(), 'c1', 'book_appointment', '{}', '{"ok": true}', 'succeeded', '2026-03-01 09:05+00'),
  (tests.business_id('nour-salon'), gen_random_uuid(), 'c2', 'book_appointment', '{}', '{"ok": false}', 'failed', '2026-03-01 09:06+00'),
  (tests.business_id('nour-salon'), gen_random_uuid(), 'c3', 'search_knowledge', '{}', '{"ok": true}', 'succeeded', '2026-03-01 09:07+00'),
  (tests.business_id('nour-salon'), gen_random_uuid(), 'c4', 'cancel_booking', '{}', null, 'declined', '2026-03-02 09:00+00'),
  (tests.business_id('nour-salon'), gen_random_uuid(), 'c5', 'request_human', '{}', '{"ok": true}', 'succeeded', '2026-03-02 09:01+00'),
  (tests.business_id('palm-clinic'), gen_random_uuid(), 'c6', 'book_appointment', '{}', '{"ok": true}', 'succeeded', '2026-03-01 09:05+00');

-- By day ---------------------------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select results_eq(
  $$ select * from public.usage_by_day(tests.business_id('nour-salon'), '2026-03-01', '2026-03-03') $$,
  $$
    values
      ('2026-03-01'::date, 1::bigint, 2::bigint, 1::bigint, 4020::bigint, 400::bigint, 0.0060004::numeric,
        200, 290, 0::bigint, 1::bigint, 1::bigint, 0::bigint, 0::bigint),
      ('2026-03-02'::date, 1::bigint, 2::bigint, 0::bigint, 2500::bigint, 200::bigint, 0.0035::numeric,
        500, 500, 1::bigint, 0::bigint, 0::bigint, 1::bigint, 1::bigint),
      ('2026-03-03'::date, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::numeric,
        null, null, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint)
  $$,
  'each local day counts what happened between its own midnights: website conversations, model calls and their cost, latency of successful chat calls, and what the tools did; quiet days show zeros'
);
select results_eq(
  $$ select day, cost_usd from public.usage_by_day(tests.business_id('nour-salon'), '2026-03-02', '2026-03-02') $$,
  $$ values ('2026-03-02'::date, 0.0035::numeric) $$,
  'a one-day report is that day alone'
);
select is_empty(
  $$ select * from public.usage_by_day(tests.business_id('nour-salon'), '2026-03-01', '2026-06-01') $$,
  'a report covers at most 92 days'
);
select is_empty(
  $$ select * from public.usage_by_day(tests.business_id('nour-salon'), '2026-03-02', '2026-03-01') $$,
  'and ends after it starts'
);

-- By model -------------------------------------------------------------------------------------------

select results_eq(
  $$ select * from public.usage_by_model(tests.business_id('nour-salon'), '2026-03-01', '2026-03-02') $$,
  $$
    values
      ('anthropic/claude-haiku-4.5', 'chat', 4::bigint, 6500::bigint, 600::bigint, 0.0095::numeric, 1::bigint),
      ('openai/text-embedding-3-small', 'search', 1::bigint, 20::bigint, 0::bigint, 0.0000004::numeric, 0::bigint)
  $$,
  'by model and purpose, the costliest first'
);
select results_eq(
  $$ select model, calls from public.usage_by_model(tests.business_id('nour-salon'), '2026-03-02', '2026-03-02') $$,
  $$ values ('anthropic/claude-haiku-4.5', 2::bigint) $$,
  'counting only calls inside the range''s local days'
);

-- Who can see it -------------------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select is_empty(
  $$ select * from public.usage_by_day(tests.business_id('nour-salon'), '2026-03-01', '2026-03-03') $$,
  'staff don''t see the business''s usage'
);
select tests.authenticate_as('owner-b@test.local');
select is_empty(
  $$ select * from public.usage_by_day(tests.business_id('nour-salon'), '2026-03-01', '2026-03-03') $$,
  'nor does another business''s owner'
);
select is_empty(
  $$ select * from public.usage_by_model(tests.business_id('nour-salon'), '2026-03-01', '2026-03-03') $$,
  'by day or by model'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select * from public.usage_by_day(gen_random_uuid(), '2026-03-01', '2026-03-03') $$,
  '42501', 'permission denied for function usage_by_day',
  'and visitors without an account can''t ask at all'
);

select * from finish();
rollback;
