-- Exceptions to the weekly hours: a staff member away for a while (time off), and whole days
-- the business is shut (closures, such as public holidays).

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  staff_id uuid not null,
  -- Moments in time (UTC), converted from the business's local time when they're entered.
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (staff_id, business_id)
    references public.staff (id, business_id) on delete cascade
);

create index time_off_staff_id on public.time_off (staff_id, ends_at);

create table public.closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Whole days in the business's own time zone, first and last included.
  starts_on date not null,
  ends_on date not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index closures_business_id on public.closures (business_id, ends_on);

alter table public.time_off enable row level security;
alter table public.closures enable row level security;

grant select, delete on public.time_off to authenticated;
grant select, delete on public.closures to authenticated;
grant insert (business_id, starts_on, ends_on, reason) on public.closures to authenticated;
-- Moments in UTC; add_time_off below is the way in from the business's local time.
grant insert (business_id, staff_id, starts_at, ends_at, reason)
  on public.time_off to authenticated;

create policy "members can view their business's time off"
  on public.time_off for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create policy "owners and admins can add time off"
  on public.time_off for insert to authenticated
  with check (private.has_business_role(business_id, '{owner,admin}'));

create policy "owners and admins can remove time off"
  on public.time_off for delete to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'));

create policy "members can view their business's closures"
  on public.closures for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create policy "owners and admins can add closures"
  on public.closures for insert to authenticated
  with check (private.has_business_role(business_id, '{owner,admin}'));

create policy "owners and admins can remove closures"
  on public.closures for delete to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'));

-- Adds time off for a staff member from local wall-clock times ("from 10:00 on 5 October"):
-- Postgres converts them to UTC with the business's time zone, so daylight saving is handled by
-- the time zone database, not by hand. Security invoker: the insert runs under the caller's RLS.
-- Returns the new row's id, or null when the caller can't see the staff member.
create function public.add_time_off(
  target_staff_id uuid,
  starts_local timestamp,
  ends_local timestamp,
  time_off_reason text default null
)
returns uuid
language sql
set search_path = ''
as $$
  insert into public.time_off (business_id, staff_id, starts_at, ends_at, reason)
  select staff.business_id, staff.id,
    starts_local at time zone businesses.timezone,
    ends_local at time zone businesses.timezone,
    nullif(btrim(time_off_reason), '')
  from public.staff
  join public.businesses on businesses.id = staff.business_id
  where staff.id = target_staff_id
  returning id;
$$;

grant execute on function public.add_time_off(uuid, timestamp, timestamp, text)
  to authenticated;
