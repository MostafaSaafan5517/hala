-- The staff inbox: members take a widget conversation over from the assistant, reply to the
-- customer, hand it back, and close it. Conversations stay unwritable through the API; these
-- security definer functions are the only changes members can make, and each checks the caller
-- is a member of the conversation's business. A conversation that doesn't exist and one the caller
-- can't see raise the same error, so nothing is confirmed to outsiders.

-- Who sent a staff reply; null for the customer's messages and the assistant's.
alter table public.conversation_messages
  add column sent_by uuid references public.profiles (id) on delete set null,
  add constraint only_replies_have_a_sender check (sent_by is null or role = 'assistant');

-- The widget conversation, locked (so a reply and the assistant's turn can't take the same
-- position), if the caller is a member of its business.
create function private.inbox_conversation(target_conversation_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation public.conversations;
begin
  select * into conversation
  from public.conversations
  where id = target_conversation_id and channel = 'widget'
  for update;
  if not found
    or not private.has_business_role(conversation.business_id, '{owner,admin,staff}') then
    raise exception 'No such conversation' using errcode = 'P0002';
  end if;
  return conversation;
end;
$$;

-- Takes a conversation over: the assistant stops answering, and the customer's messages wait for
-- the team. Any member may, from a colleague too.
create function public.take_over_conversation(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation public.conversations := private.inbox_conversation(target_conversation_id);
begin
  if conversation.status = 'closed' then
    raise exception 'This conversation is closed' using errcode = 'HB009';
  end if;
  update public.conversations
  set status = 'taken_over', taken_over_by = auth.uid(), updated_at = now()
  where id = conversation.id;
end;
$$;

-- Gives a conversation back to the assistant, which answers the customer's next message.
create function public.hand_back_conversation(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation public.conversations := private.inbox_conversation(target_conversation_id);
begin
  if conversation.status <> 'taken_over' then
    raise exception 'This conversation isn''t with the team' using errcode = 'HB009';
  end if;
  update public.conversations
  set status = 'open', taken_over_by = null, updated_at = now()
  where id = conversation.id;
end;
$$;

-- Closes a conversation: nobody can add to it, and the customer is offered a new one.
create function public.close_conversation(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation public.conversations := private.inbox_conversation(target_conversation_id);
begin
  if conversation.status = 'closed' then
    raise exception 'This conversation is already closed' using errcode = 'HB009';
  end if;
  update public.conversations
  set status = 'closed', updated_at = now()
  where id = conversation.id;
end;
$$;

-- A reply from the team, shown in the customer's chat. Only while the team has the conversation,
-- so the assistant and a person never answer at once. The message is built here from plain text,
-- so a reply can't carry anything else (a confirmation card, for one).
create function public.reply_to_conversation(target_conversation_id uuid, body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation public.conversations := private.inbox_conversation(target_conversation_id);
  reply text := regexp_replace(body, '^\s+|\s+$', '', 'g');
  message_id text := 'staff-' || gen_random_uuid();
begin
  if conversation.status <> 'taken_over' then
    raise exception 'Take the conversation over before replying' using errcode = 'HB009';
  end if;
  if coalesce(char_length(reply), 0) not between 1 and 2000 then
    raise exception 'A reply is 1 to 2000 characters' using errcode = '22023';
  end if;

  insert into public.conversation_messages
    (conversation_id, business_id, id, position, role, message, sent_by)
  values (
    conversation.id,
    conversation.business_id,
    message_id,
    (select coalesce(max(position) + 1, 0)
     from public.conversation_messages
     where conversation_id = conversation.id),
    'assistant',
    jsonb_build_object(
      'id', message_id,
      'role', 'assistant',
      'parts', jsonb_build_array(jsonb_build_object('type', 'text', 'text', reply)),
      'metadata', jsonb_build_object('from', 'staff')
    ),
    auth.uid()
  );
  update public.conversations set updated_at = now() where id = conversation.id;
end;
$$;

grant execute on function
  public.take_over_conversation(uuid),
  public.hand_back_conversation(uuid),
  public.close_conversation(uuid),
  public.reply_to_conversation(uuid, text)
to authenticated;
