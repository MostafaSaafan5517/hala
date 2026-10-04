-- Every call to an AI model, for cost control: which business it was for, why, which model,
-- the tokens it used, what it cost and how long it took. Server code writes it (users can't, so
-- nobody can hide or invent usage), and like the audit log it is append-only. Rate limits,
-- token budgets and the usage dashboard read from it.

create table public.model_calls (
  id bigint generated always as identity primary key,
  -- No foreign key: the record of what was spent must outlive the business.
  business_id uuid not null,
  -- index: embedding a business's documents; search: embedding a question to look them up.
  purpose text not null check (purpose in ('index', 'search')),
  model text not null check (char_length(model) between 1 and 100),
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- In US dollars, from the tokens and the model's published price.
  cost_usd numeric(14, 10) not null check (cost_usd >= 0),
  latency_ms integer not null check (latency_ms >= 0),
  -- Null when the call succeeded, otherwise the error's name.
  error text check (char_length(error) <= 200),
  created_at timestamptz not null default now()
);

create index model_calls_business_id_created_at on public.model_calls (business_id, created_at desc);

alter table public.model_calls enable row level security;

revoke all on public.model_calls from service_role;
grant select, insert on public.model_calls to service_role;
grant select on public.model_calls to authenticated;

create policy "owners and admins see their business's model usage"
  on public.model_calls for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'));

create trigger model_calls_are_append_only
  before update or delete on public.model_calls
  for each row execute function private.reject_change();
create trigger model_calls_cannot_be_truncated
  before truncate on public.model_calls
  for each statement execute function private.reject_change();
