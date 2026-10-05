-- The Usage tab: what the assistant did and what it cost, per day in the business's own time zone
-- (each day's boundaries converted in Postgres, so daylight saving is right), and per model.
-- Owners and admins only, like the usage log itself. Both functions run with the caller's
-- rights and also check the role, so anyone else, including the business's staff, gets no rows.
-- A report covers 1 to 92 days.

create function public.usage_by_day(target_business_id uuid, first_day date, last_day date)
returns table (
  day date,
  -- Conversations started on the business's website.
  conversations bigint,
  chat_calls bigint,
  embedding_calls bigint,
  input_tokens bigint,
  output_tokens bigint,
  cost_usd numeric,
  -- How long successful chat calls took, the median and the slowest one in twenty.
  chat_latency_p50_ms integer,
  chat_latency_p95_ms integer,
  failed_model_calls bigint,
  -- Bookings the assistant made, and its tool calls that were refused or declined.
  bookings bigint,
  failed_tool_calls bigint,
  declined_tool_calls bigint,
  -- Times the assistant asked for a person.
  person_requests bigint
)
language sql
stable
set search_path = ''
as $$
  with business as (
    select id, timezone
    from public.businesses
    where id = target_business_id
      and private.has_business_role(id, '{owner,admin}')
      and last_day >= first_day
      and last_day - first_day < 92
  ),
  days as (
    select
      first_day + offset_days as day,
      (first_day + offset_days)::timestamp at time zone business.timezone as starts_at,
      (first_day + offset_days + 1)::timestamp at time zone business.timezone as ends_at
    from business, generate_series(0, last_day - first_day) as offset_days
  )
  select
    days.day,
    started.conversations,
    calls.chat_calls,
    calls.embedding_calls,
    calls.input_tokens,
    calls.output_tokens,
    calls.cost_usd,
    calls.chat_latency_p50_ms,
    calls.chat_latency_p95_ms,
    calls.failed_model_calls,
    tools.bookings,
    tools.failed_tool_calls,
    tools.declined_tool_calls,
    tools.person_requests
  from days
  cross join lateral (
    select count(*) as conversations
    from public.conversations conversation
    where conversation.business_id = target_business_id
      and conversation.channel = 'widget'
      and conversation.created_at >= days.starts_at
      and conversation.created_at < days.ends_at
  ) started
  cross join lateral (
    select
      count(*) filter (where call.purpose = 'chat') as chat_calls,
      count(*) filter (where call.purpose in ('index', 'search')) as embedding_calls,
      coalesce(sum(call.input_tokens), 0)::bigint as input_tokens,
      coalesce(sum(call.output_tokens), 0)::bigint as output_tokens,
      coalesce(sum(call.cost_usd), 0) as cost_usd,
      round(percentile_cont(0.5) within group (order by call.latency_ms)
        filter (where call.purpose = 'chat' and call.error is null))::integer
        as chat_latency_p50_ms,
      round(percentile_cont(0.95) within group (order by call.latency_ms)
        filter (where call.purpose = 'chat' and call.error is null))::integer
        as chat_latency_p95_ms,
      count(*) filter (where call.error is not null) as failed_model_calls
    from public.model_calls call
    where call.business_id = target_business_id
      and call.created_at >= days.starts_at
      and call.created_at < days.ends_at
  ) calls
  cross join lateral (
    select
      count(*) filter (where tool.tool_name = 'book_appointment' and tool.status = 'succeeded')
        as bookings,
      count(*) filter (where tool.status = 'failed') as failed_tool_calls,
      count(*) filter (where tool.status = 'declined') as declined_tool_calls,
      count(*) filter (where tool.tool_name = 'request_human' and tool.status = 'succeeded')
        as person_requests
    from public.tool_calls tool
    where tool.business_id = target_business_id
      and tool.created_at >= days.starts_at
      and tool.created_at < days.ends_at
  ) tools
  order by days.day;
$$;

create function public.usage_by_model(target_business_id uuid, first_day date, last_day date)
returns table (
  model text,
  purpose text,
  calls bigint,
  input_tokens bigint,
  output_tokens bigint,
  cost_usd numeric,
  failed_calls bigint
)
language sql
stable
set search_path = ''
as $$
  select
    call.model,
    call.purpose,
    count(*),
    sum(call.input_tokens)::bigint,
    sum(call.output_tokens)::bigint,
    sum(call.cost_usd),
    count(*) filter (where call.error is not null)
  from public.model_calls call
  join public.businesses business on business.id = call.business_id
  where call.business_id = target_business_id
    and private.has_business_role(business.id, '{owner,admin}')
    and last_day >= first_day
    and last_day - first_day < 92
    and call.created_at >= first_day::timestamp at time zone business.timezone
    and call.created_at < (last_day + 1)::timestamp at time zone business.timezone
  group by call.model, call.purpose
  order by sum(call.cost_usd) desc, call.model, call.purpose;
$$;

grant execute on function
  public.usage_by_day(uuid, date, date),
  public.usage_by_model(uuid, date, date)
to authenticated;
