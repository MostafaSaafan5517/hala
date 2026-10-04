-- Conversations with the assistant, their messages, and every action (tool call) the assistant
-- took in them. Server code writes all of it: the browser never sends history, only the newest
-- message or an approval, so nobody can rewrite what was said. Members read their business's
-- conversations (the inbox); owners and admins read the tool-call audit.

create type public.conversation_status as enum ('open', 'needs_human', 'closed');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- test: a member trying the assistant from the dashboard. widget: a customer on the business's
  -- website (Phase 5).
  channel text not null check (channel in ('test', 'widget')),
  -- The member who started a test conversation.
  started_by uuid references public.profiles (id) on delete set null,
  -- The customer the assistant acts for, once known: they booked in this conversation, or proved
  -- a booking is theirs with its reference and their phone number.
  customer_id uuid,
  status public.conversation_status not null default 'open',
  -- Failed attempts to prove a booking is theirs. The assistant stops trying after a few, so a
  -- reference can't be guessed.
  verification_failures integer not null default 0 check (verification_failures >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id)
);

create index conversations_business_id_updated_at
  on public.conversations (business_id, updated_at desc);

create table public.conversation_messages (
  conversation_id uuid not null,
  business_id uuid not null,
  -- The AI SDK's message id, unique within its conversation.
  id text not null check (char_length(id) between 1 and 100),
  position integer not null check (position >= 0),
  role text not null check (role in ('user', 'assistant')),
  -- The whole AI SDK UI message: text, and tool calls with their inputs, approvals and outputs.
  message jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, id),
  unique (conversation_id, position),
  foreign key (conversation_id, business_id)
    references public.conversations (id, business_id) on delete cascade
);

-- Every tool call the assistant made, as it ran: append-only, like the audit log. A call that
-- needed the customer's approval is recorded when it ran, or when the customer declined.
create table public.tool_calls (
  id bigint generated always as identity primary key,
  -- No foreign keys: the record of what the assistant did must outlive what it did it to.
  business_id uuid not null,
  conversation_id uuid not null,
  tool_call_id text not null check (char_length(tool_call_id) between 1 and 200),
  tool_name text not null check (char_length(tool_name) between 1 and 100),
  input jsonb not null,
  -- What the tool returned, refusals included; null when the customer declined.
  output jsonb,
  -- succeeded; failed (refused by the rules, or errored: the output says why); declined (the
  -- customer didn't approve).
  status text not null check (status in ('succeeded', 'failed', 'declined')),
  -- Whether the customer approved the call first (booking, moving, cancelling).
  approved boolean not null default false,
  latency_ms integer not null default 0 check (latency_ms >= 0),
  created_at timestamptz not null default now()
);

create index tool_calls_conversation_id on public.tool_calls (conversation_id, id);

-- Chat calls belong to a conversation, which the assistant's token budget counts.
alter table public.model_calls add column conversation_id uuid;
alter table public.model_calls drop constraint model_calls_purpose_check;
alter table public.model_calls add constraint model_calls_purpose_check
  check (purpose in ('index', 'search', 'chat'));
create index model_calls_conversation_id
  on public.model_calls (conversation_id) where conversation_id is not null;

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.tool_calls enable row level security;

grant select on public.conversations, public.conversation_messages, public.tool_calls
  to authenticated;
revoke all on public.tool_calls from service_role;
grant select, insert on public.tool_calls to service_role;

create policy "members can view their business's conversations"
  on public.conversations for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create policy "members can view their business's messages"
  on public.conversation_messages for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create policy "owners and admins see what the assistant did"
  on public.tool_calls for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'));

create trigger tool_calls_are_append_only
  before update or delete on public.tool_calls
  for each row execute function private.reject_change();
create trigger tool_calls_cannot_be_truncated
  before truncate on public.tool_calls
  for each statement execute function private.reject_change();

-- What a conversation and its business have used, for the assistant's limits: the tokens spent
-- in this conversation, the business's chat calls in the last minute, and what the business has
-- spent on AI today (its own local day). Server code only.
create function public.chat_usage(target_conversation_id uuid)
returns table (
  conversation_tokens bigint,
  business_chat_calls_last_minute bigint,
  business_cost_today numeric
)
language sql
stable
set search_path = ''
as $$
  select
    (select coalesce(sum(calls.input_tokens + calls.output_tokens), 0)
     from public.model_calls calls
     where calls.conversation_id = conversation.id),
    (select count(*)
     from public.model_calls calls
     where calls.business_id = conversation.business_id
       and calls.purpose = 'chat'
       and calls.created_at > now() - interval '1 minute'),
    (select coalesce(sum(calls.cost_usd), 0)
     from public.model_calls calls
     where calls.business_id = conversation.business_id
       and calls.created_at
         >= (now() at time zone business.timezone)::date::timestamp at time zone business.timezone)
  from public.conversations conversation
  join public.businesses business on business.id = conversation.business_id
  where conversation.id = target_conversation_id;
$$;

grant execute on function public.chat_usage(uuid) to service_role;
