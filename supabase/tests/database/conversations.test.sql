begin;
select plan(18);
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
insert into public.customers (business_id, name, phone, language) values
  (tests.business_id('nour-salon'), 'Mona Adel', '+201012345678', 'ar'),
  (tests.business_id('cedar-clinic'), 'Sara Ali', '+966501234567', 'en');

-- Server code writes conversations --------------------------------------------------------------

select tests.authenticate_as_service_role();
insert into public.conversations (id, business_id, channel, started_by) values
  ('60000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'test',
    tests.get_user_id('staff-a@test.local')),
  ('60000000-0000-0000-0000-000000000002', tests.business_id('cedar-clinic'), 'widget', null);
select lives_ok(
  $$
    insert into public.conversation_messages (conversation_id, business_id, id, position, role, message)
    values
      ('60000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'm1', 0, 'user',
        '{"id": "m1", "role": "user", "parts": [{"type": "text", "text": "Is there parking?"}]}'),
      ('60000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'm2', 1, 'assistant',
        '{"id": "m2", "role": "assistant", "parts": [{"type": "text", "text": "Yes."}]}')
  $$,
  'server code stores a conversation''s messages'
);
select throws_ok(
  $$
    insert into public.conversation_messages (conversation_id, business_id, id, position, role, message)
    values ('60000000-0000-0000-0000-000000000001', tests.business_id('cedar-clinic'), 'm3', 2,
      'user', '{}')
  $$,
  '23503', null,
  'a message stays in its conversation''s business'
);
select throws_ok(
  $$
    update public.conversations
    set customer_id = (select id from public.customers where name = 'Sara Ali')
    where id = '60000000-0000-0000-0000-000000000001'
  $$,
  '23503', null,
  'a conversation can only act for a customer of its own business'
);
select lives_ok(
  $$
    update public.conversations
    set customer_id = (select id from public.customers where name = 'Mona Adel'),
      status = 'needs_human'
    where id = '60000000-0000-0000-0000-000000000001'
  $$,
  'and server code records who the customer is, and a handoff'
);

-- Who can read them -------------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select results_eq(
  $$
    select message -> 'parts' -> 0 ->> 'text' from public.conversation_messages
    order by position
  $$,
  $$ values ('Is there parking?'), ('Yes.') $$,
  'members read their business''s conversations'
);
select tests.authenticate_as('owner-b@test.local');
select results_eq(
  $$ select channel from public.conversations $$,
  $$ values ('widget') $$,
  'and only those'
);
select is_empty(
  $$ select 1 from public.conversation_messages $$,
  'other businesses see none of the messages'
);
select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$
    insert into public.conversations (business_id, channel)
    values (tests.business_id('nour-salon'), 'test')
  $$,
  '42501', 'permission denied for table conversations',
  'members cannot write conversations directly'
);
select throws_ok(
  $$ update public.conversation_messages set message = '{}' $$,
  '42501', 'permission denied for table conversation_messages',
  'or rewrite what was said'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.conversations $$,
  '42501', 'permission denied for table conversations',
  'visitors cannot read conversations'
);

-- The tool-call audit ---------------------------------------------------------------------------

select tests.authenticate_as_service_role();
select lives_ok(
  $$
    insert into public.tool_calls (business_id, conversation_id, tool_call_id, tool_name, input, output, status, approved, latency_ms)
    values (tests.business_id('nour-salon'), '60000000-0000-0000-0000-000000000001', 'call-1',
      'book_appointment', '{"service_id": "x"}', '{"booked": true}', 'succeeded', true, 120)
  $$,
  'server code records each tool call'
);
select throws_ok(
  $$ update public.tool_calls set status = 'failed' $$,
  '42501', 'permission denied for table tool_calls',
  'and cannot change one'
);
select tests.act_as_database();
select throws_ok(
  $$ delete from public.tool_calls $$,
  'P0001', 'tool_calls is append-only: its rows can''t be changed or deleted',
  'nor can the database itself'
);
select tests.authenticate_as('admin-a@test.local');
select results_eq(
  $$ select tool_name, approved from public.tool_calls where conversation_id = '60000000-0000-0000-0000-000000000001' $$,
  $$ values ('book_appointment', true) $$,
  'owners and admins see what the assistant did'
);
select tests.authenticate_as('staff-a@test.local');
select is_empty($$ select 1 from public.tool_calls $$, 'staff do not');

-- Usage, for the assistant's limits -------------------------------------------------------------

select tests.authenticate_as_service_role();
insert into public.model_calls (business_id, conversation_id, purpose, model, input_tokens, output_tokens, cost_usd, latency_ms, created_at)
values
  (tests.business_id('nour-salon'), '60000000-0000-0000-0000-000000000001', 'chat', 'offline', 1000, 200, 0.004, 900, now()),
  (tests.business_id('nour-salon'), '60000000-0000-0000-0000-000000000001', 'chat', 'offline', 1500, 300, 0.006, 800, now()),
  (tests.business_id('nour-salon'), null, 'search', 'offline', 10, 0, 0.001, 50, now()),
  (tests.business_id('nour-salon'), null, 'chat', 'offline', 10, 0, 0.5, 50, now() - interval '3 days');
select results_eq(
  $$ select * from public.chat_usage('60000000-0000-0000-0000-000000000001') $$,
  $$ values (3000::bigint, 2::bigint, 0.011::numeric) $$,
  'chat_usage counts the conversation''s tokens, the business''s chat calls this minute and its spend today'
);
select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ select * from public.chat_usage('60000000-0000-0000-0000-000000000001') $$,
  '42501', 'permission denied for function chat_usage',
  'only server code asks'
);
select tests.act_as_database();
select throws_ok(
  $$
    insert into public.model_calls (business_id, purpose, model, input_tokens, cost_usd, latency_ms)
    values (tests.business_id('nour-salon'), 'translate', 'offline', 0, 0, 0)
  $$,
  '23514', null,
  'model calls still have a known purpose'
);

select * from finish();
rollback;
