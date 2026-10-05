begin;
select plan(24);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Nour Salon', 'nour-salon', 'Africa/Cairo', 'ar');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Palm Clinic', 'palm-clinic', 'Asia/Riyadh', 'en');
select tests.act_as_database();

insert into public.business_members (business_id, user_id, role) values
  (tests.business_id('nour-salon'), tests.get_user_id('staff-a@test.local'), 'staff');

-- A widget conversation with one message from the customer, and a member's test conversation.
insert into public.conversations (id, business_id, channel, visitor_token_hash, visitor_hash) values
  ('71000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'widget', repeat('1', 64), repeat('f', 64));
insert into public.conversations (id, business_id, channel, started_by) values
  ('71000000-0000-0000-0000-000000000002', tests.business_id('nour-salon'), 'test', tests.get_user_id('owner-a@test.local'));
select public.save_conversation_messages(
  '71000000-0000-0000-0000-000000000001',
  '[{"id": "m1", "role": "user", "parts": [{"type": "text", "text": "Can I talk to someone?"}]}]'
);

-- Outsiders ----------------------------------------------------------------------------------------

select tests.authenticate_as('owner-b@test.local');
select throws_ok(
  $$ select public.take_over_conversation('71000000-0000-0000-0000-000000000001') $$,
  'P0002', 'No such conversation',
  'another business''s owner can''t take a conversation over'
);
select throws_ok(
  $$ select public.close_conversation('71000000-0000-0000-0000-000000000001') $$,
  'P0002', 'No such conversation',
  'or close it'
);
select throws_ok(
  $$ select public.take_over_conversation(gen_random_uuid()) $$,
  'P0002', 'No such conversation',
  'and can''t tell it from one that doesn''t exist'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.take_over_conversation('71000000-0000-0000-0000-000000000001') $$,
  '42501', 'permission denied for function take_over_conversation',
  'visitors without an account can''t call the inbox''s actions at all'
);
select tests.act_as_database();
select results_eq(
  $$ select status::text, taken_over_by from public.conversations where id = '71000000-0000-0000-0000-000000000001' $$,
  $$ values ('open', null::uuid) $$,
  'none of that changed anything'
);

-- Taking over and replying -------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$ select public.reply_to_conversation('71000000-0000-0000-0000-000000000001', 'Hello') $$,
  'HB009', 'Take the conversation over before replying',
  'a member replies only after taking the conversation over, so the assistant and a person never both answer'
);
select throws_ok(
  $$ select public.hand_back_conversation('71000000-0000-0000-0000-000000000001') $$,
  'HB009', 'This conversation isn''t with the team',
  'and can''t hand back a conversation nobody took'
);
select throws_ok(
  $$ select public.take_over_conversation('71000000-0000-0000-0000-000000000002') $$,
  'P0002', 'No such conversation',
  'the inbox is for website conversations, not members'' tests'
);
select lives_ok(
  $$ select public.take_over_conversation('71000000-0000-0000-0000-000000000001') $$,
  'staff take a conversation over'
);
select tests.act_as_database();
select results_eq(
  $$ select status::text, taken_over_by from public.conversations where id = '71000000-0000-0000-0000-000000000001' $$,
  $$ values ('taken_over', tests.get_user_id('staff-a@test.local')) $$,
  'which records who has it'
);

select tests.authenticate_as('staff-a@test.local');
select lives_ok(
  $$ select public.reply_to_conversation('71000000-0000-0000-0000-000000000001', E'  Hi, this is Sara.\n  ') $$,
  'and reply'
);
select throws_ok(
  $$ select public.reply_to_conversation('71000000-0000-0000-0000-000000000001', '   ') $$,
  '22023', 'A reply is 1 to 2000 characters',
  'a reply has some text'
);
select throws_ok(
  $$ select public.reply_to_conversation('71000000-0000-0000-0000-000000000001', repeat('a', 2001)) $$,
  '22023', 'A reply is 1 to 2000 characters',
  'and not too much'
);
select tests.act_as_database();
select results_eq(
  $$
    select position, role, sent_by, message -> 'parts', message -> 'metadata', message ->> 'id' = id
    from public.conversation_messages
    where conversation_id = '71000000-0000-0000-0000-000000000001'
    order by position
  $$,
  $$
    values
      (0, 'user', null::uuid, '[{"type": "text", "text": "Can I talk to someone?"}]'::jsonb, null::jsonb, true),
      (1, 'assistant', tests.get_user_id('staff-a@test.local'),
        '[{"type": "text", "text": "Hi, this is Sara."}]'::jsonb, '{"from": "staff"}'::jsonb, true)
  $$,
  'the reply goes at the end of the chat: plain text, marked as from the team, with who sent it'
);
select throws_ok(
  $$
    insert into public.conversation_messages (conversation_id, business_id, id, position, role, message, sent_by)
    values ('71000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'x', 9, 'user', '{}',
      tests.get_user_id('staff-a@test.local'))
  $$,
  '23514', null,
  'only replies have a sender: a customer''s message is never attributed to a member'
);

select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$
    insert into public.conversation_messages (conversation_id, business_id, id, position, role, message)
    values ('71000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'x', 9, 'assistant', '{}')
  $$,
  '42501', 'permission denied for table conversation_messages',
  'members can''t write messages directly, so a reply can''t be anything but plain text'
);

-- Handing back and closing -------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select lives_ok(
  $$ select public.hand_back_conversation('71000000-0000-0000-0000-000000000001') $$,
  'a member hands the conversation back to the assistant'
);
select tests.act_as_database();
select results_eq(
  $$ select status::text, taken_over_by from public.conversations where id = '71000000-0000-0000-0000-000000000001' $$,
  $$ values ('open', null::uuid) $$,
  'which answers again'
);

select tests.authenticate_as('owner-a@test.local');
select lives_ok(
  $$ select public.close_conversation('71000000-0000-0000-0000-000000000001') $$,
  'and closes it'
);
select throws_ok(
  $$ select public.close_conversation('71000000-0000-0000-0000-000000000001') $$,
  'HB009', 'This conversation is already closed',
  'once'
);
select throws_ok(
  $$ select public.take_over_conversation('71000000-0000-0000-0000-000000000001') $$,
  'HB009', 'This conversation is closed',
  'a closed conversation can''t be taken over'
);
select throws_ok(
  $$ select public.reply_to_conversation('71000000-0000-0000-0000-000000000001', 'One more thing') $$,
  'HB009', 'Take the conversation over before replying',
  'or replied to'
);
select tests.act_as_database();
select results_eq(
  $$ select status::text from public.conversations where id = '71000000-0000-0000-0000-000000000001' $$,
  $$ values ('closed') $$,
  'and stays closed'
);
select is(
  (select count(*)::integer from public.conversation_messages where conversation_id = '71000000-0000-0000-0000-000000000001'),
  2,
  'with nothing added after it closed'
);

select * from finish();
rollback;
