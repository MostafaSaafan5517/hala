begin;
select plan(19);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Nour Salon', 'nour-salon', 'Africa/Cairo', 'ar');
select tests.act_as_database();

insert into public.business_members (business_id, user_id, role) values
  (tests.business_id('nour-salon'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('nour-salon'), tests.get_user_id('staff-a@test.local'), 'staff');

-- The widget's settings --------------------------------------------------------------------------

select results_eq(
  $$ select widget_enabled, widget_origins from public.businesses where slug = 'nour-salon' $$,
  $$ values (false, '{}'::text[]) $$,
  'the widget is off, and allowed nowhere, until the business sets it up'
);
select tests.authenticate_as('admin-a@test.local');
update public.businesses
set widget_enabled = true, widget_origins = '{https://nour-salon.com,http://localhost:3000}'
where slug = 'nour-salon';
select tests.authenticate_as('staff-a@test.local');
update public.businesses set widget_enabled = false where slug = 'nour-salon';
select tests.act_as_database();
select results_eq(
  $$ select widget_enabled, widget_origins from public.businesses where slug = 'nour-salon' $$,
  $$ values (true, '{https://nour-salon.com,http://localhost:3000}'::text[]) $$,
  'owners and admins set it up; staff cannot change it'
);
select throws_ok(
  $$ update public.businesses set widget_origins = '{nour-salon.com}' where slug = 'nour-salon' $$,
  '23514', null, 'an origin needs its scheme'
);
select throws_ok(
  $$ update public.businesses set widget_origins = '{https://nour-salon.com/booking}' where slug = 'nour-salon' $$,
  '23514', null, 'and is only scheme, host and port, no path'
);
select throws_ok(
  $$ update public.businesses set widget_origins = '{HTTPS://NOUR-SALON.COM}' where slug = 'nour-salon' $$,
  '23514', null, 'written in lowercase, as browsers send it'
);
select throws_ok(
  $$
    update public.businesses
    set widget_origins = (select array_agg('https://site' || n || '.com') from generate_series(1, 11) as n)
    where slug = 'nour-salon'
  $$,
  '23514', null, 'and there are at most ten'
);

-- Conversations from the widget -------------------------------------------------------------------

select tests.authenticate_as_service_role();
select throws_ok(
  $$ insert into public.conversations (business_id, channel) values (tests.business_id('nour-salon'), 'widget') $$,
  '23514', null, 'a widget conversation always belongs to a visitor (their token)'
);
select throws_ok(
  $$
    insert into public.conversations (business_id, channel, visitor_token_hash, visitor_hash)
    values (tests.business_id('nour-salon'), 'test', repeat('a', 64), repeat('b', 64))
  $$,
  '23514', null, 'and a test conversation never does'
);
insert into public.conversations (id, business_id, channel, visitor_token_hash, visitor_hash) values
  ('70000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'widget', repeat('1', 64), repeat('f', 64)),
  ('70000000-0000-0000-0000-000000000002', tests.business_id('nour-salon'), 'widget', repeat('2', 64), repeat('f', 64));
select throws_ok(
  $$
    insert into public.conversations (business_id, channel, visitor_token_hash, visitor_hash)
    values (tests.business_id('nour-salon'), 'widget', repeat('1', 64), repeat('e', 64))
  $$,
  '23505', null, 'each token opens one conversation'
);
select lives_ok(
  $$
    update public.conversations
    set status = 'taken_over', taken_over_by = tests.get_user_id('staff-a@test.local')
    where id = '70000000-0000-0000-0000-000000000001'
  $$,
  'a member can take a conversation over'
);

-- Adding messages ---------------------------------------------------------------------------------

-- Back-dated, to see saving update it (now() is fixed for the whole test transaction).
update public.conversations set updated_at = '2026-01-01' where id = '70000000-0000-0000-0000-000000000001';
select public.save_conversation_messages(
  '70000000-0000-0000-0000-000000000001',
  '[{"id": "m1", "role": "user", "parts": []}, {"id": "m2", "role": "assistant", "parts": []}]'
);
select public.save_conversation_messages(
  '70000000-0000-0000-0000-000000000001',
  '[{"id": "m1", "role": "user", "parts": []},
    {"id": "m2", "role": "assistant", "parts": [{"type": "text", "text": "grown"}]},
    {"id": "m3", "role": "user", "parts": []}]'
);
select public.save_conversation_messages(
  '70000000-0000-0000-0000-000000000001',
  '[{"id": "s1", "role": "assistant", "metadata": {"from": "staff"}, "parts": []}]'
);
select results_eq(
  $$
    select id, position, role, message -> 'parts' -> 0 ->> 'text'
    from public.conversation_messages
    where conversation_id = '70000000-0000-0000-0000-000000000001'
    order by position
  $$,
  $$
    values ('m1', 0, 'user', null), ('m2', 1, 'assistant', 'grown'), ('m3', 2, 'user', null),
      ('s1', 3, 'assistant', null)
  $$,
  'messages it has are updated in place; new ones go at the end, in order'
);
select ok(
  (select updated_at = now() from public.conversations where id = '70000000-0000-0000-0000-000000000001'),
  'and the conversation records when it last changed'
);
select throws_ok(
  $$ select public.save_conversation_messages(gen_random_uuid(), '[]') $$,
  'P0002', 'No such conversation',
  'there must be a conversation to add to'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ select public.save_conversation_messages('70000000-0000-0000-0000-000000000001', '[]') $$,
  '42501', 'permission denied for function save_conversation_messages',
  'only server code adds messages'
);
select throws_ok(
  $$ select * from public.visitor_usage(repeat('f', 64)) $$,
  '42501', 'permission denied for function visitor_usage',
  'or asks what a visitor has used'
);

-- What a visitor has used -----------------------------------------------------------------------

select tests.authenticate_as_service_role();
insert into public.model_calls (business_id, conversation_id, purpose, model, input_tokens, cost_usd, latency_ms)
values
  (tests.business_id('nour-salon'), '70000000-0000-0000-0000-000000000001', 'chat', 'offline', 10, 0, 0),
  (tests.business_id('nour-salon'), '70000000-0000-0000-0000-000000000002', 'chat', 'offline', 10, 0, 0),
  (tests.business_id('nour-salon'), '70000000-0000-0000-0000-000000000002', 'search', 'offline', 10, 0, 0);
select results_eq(
  $$ select * from public.visitor_usage(repeat('f', 64)) $$,
  $$ values (2::bigint, 2::bigint) $$,
  'visitor_usage counts their conversations this hour and their chat calls this minute'
);
select results_eq(
  $$ select * from public.visitor_usage(repeat('9', 64)) $$,
  $$ values (0::bigint, 0::bigint) $$,
  'and nothing for a new visitor'
);

select tests.authenticate_as('staff-a@test.local');
select results_eq(
  $$ select status::text from public.conversations where id = '70000000-0000-0000-0000-000000000001' $$,
  $$ values ('taken_over') $$,
  'members see who has the conversation'
);
select throws_ok(
  $$ update public.conversations set status = 'open' $$,
  '42501', 'permission denied for table conversations',
  'but change it only through the inbox''s actions'
);

select * from finish();
rollback;
