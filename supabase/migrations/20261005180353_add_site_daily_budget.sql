-- A daily budget for the whole deployment, on top of each business's: a public demo lets anyone
-- create a business, and each would otherwise get its own allowance from one shared AI credit.
-- chat_usage also returns what every business together has spent today (UTC); the app compares
-- it with SITE_DAILY_BUDGET_USD when that's set.

create index model_calls_created_at on public.model_calls (created_at);

drop function public.chat_usage(uuid);

create function public.chat_usage(target_conversation_id uuid)
returns table (
  conversation_tokens bigint,
  business_chat_calls_last_minute bigint,
  business_cost_today numeric,
  site_cost_today numeric
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
         >= (now() at time zone business.timezone)::date::timestamp at time zone business.timezone),
    (select coalesce(sum(calls.cost_usd), 0)
     from public.model_calls calls
     where calls.created_at >= (now() at time zone 'UTC')::date::timestamp at time zone 'UTC')
  from public.conversations conversation
  join public.businesses business on business.id = conversation.business_id
  where conversation.id = target_conversation_id;
$$;

grant execute on function public.chat_usage(uuid) to service_role;
