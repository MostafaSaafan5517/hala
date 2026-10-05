-- What the website widget and the staff inbox need: the widget's settings, how a visitor's
-- conversation is tied to them, who took a conversation over, and one safe way to add messages
-- that both the assistant and staff use.

-- The widget's settings ------------------------------------------------------------------------

-- Origins as browsers send them: scheme, host and optional port, nothing else
-- ("https://nour-salon.com", "http://localhost:3000").
create function private.are_web_origins(origins text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    bool_and(
      origin ~ '^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:[0-9]{1,5})?$'
    ),
    true
  )
  from unnest(origins) as origin;
$$;

alter table public.businesses
  -- Off until the business turns it on.
  add column widget_enabled boolean not null default false,
  -- The websites allowed to show the widget: browsers refuse to show it anywhere else.
  add column widget_origins text[] not null default '{}'
    check (cardinality(widget_origins) <= 10 and private.are_web_origins(widget_origins));

grant execute on function private.are_web_origins(text[]) to authenticated, service_role;
grant update (widget_enabled, widget_origins) on public.businesses to authenticated;

-- Conversations from the widget, and takeovers ----------------------------------------------------

alter table public.conversations
  -- A widget conversation belongs to whoever holds its random token (kept in their browser).
  -- Only the token's SHA-256 is stored, like a password.
  add column visitor_token_hash text unique check (visitor_token_hash ~ '^[0-9a-f]{64}$'),
  -- A keyed hash of the visitor's IP address, for per-visitor limits. Never the address itself.
  add column visitor_hash text check (visitor_hash ~ '^[0-9a-f]{64}$'),
  -- The member who took the conversation over.
  add column taken_over_by uuid references public.profiles (id) on delete set null,
  add constraint widget_conversations_have_a_visitor
    check ((channel = 'widget') = (visitor_token_hash is not null and visitor_hash is not null));

create index conversations_visitor_hash_created_at
  on public.conversations (visitor_hash, created_at) where visitor_hash is not null;

-- Adding messages ---------------------------------------------------------------------------------

-- Saves messages into a conversation: a message it already has is updated in place (the
-- assistant's reply grows after an approval), a new one goes at the end. The conversation row is
-- locked first, so a staff reply and the assistant's can't take the same position. Server code
-- only: the assistant's turns come through here.
create function public.save_conversation_messages(target_conversation_id uuid, messages jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  conversation public.conversations;
  next_position integer;
  item jsonb;
begin
  select * into conversation
  from public.conversations
  where id = target_conversation_id
  for update;
  if not found then
    raise exception 'No such conversation' using errcode = 'P0002';
  end if;

  select coalesce(max(position) + 1, 0) into next_position
  from public.conversation_messages
  where conversation_id = target_conversation_id;

  for item in select value from jsonb_array_elements(messages)
  loop
    update public.conversation_messages
    set message = item, updated_at = now()
    where conversation_id = target_conversation_id and id = item ->> 'id';
    if not found then
      insert into public.conversation_messages (conversation_id, business_id, id, position, role, message)
      values (
        target_conversation_id, conversation.business_id, item ->> 'id', next_position,
        item ->> 'role', item
      );
      next_position := next_position + 1;
    end if;
  end loop;

  update public.conversations set updated_at = now() where id = target_conversation_id;
end;
$$;

grant execute on function public.save_conversation_messages(uuid, jsonb) to service_role;

-- What a visitor has used, for the widget's per-visitor limits: conversations they started in
-- the last hour, and chat calls across their conversations in the last minute. Server code only.
create function public.visitor_usage(target_visitor_hash text)
returns table (conversations_last_hour bigint, chat_calls_last_minute bigint)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*)
     from public.conversations
     where visitor_hash = target_visitor_hash and created_at > now() - interval '1 hour'),
    (select count(*)
     from public.model_calls calls
     join public.conversations conversation on conversation.id = calls.conversation_id
     where conversation.visitor_hash = target_visitor_hash
       and calls.purpose = 'chat'
       and calls.created_at > now() - interval '1 minute');
$$;

grant execute on function public.visitor_usage(text) to service_role;
