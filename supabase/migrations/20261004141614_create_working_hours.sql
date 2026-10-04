-- When people can be booked: weekly opening hours for the business, and optionally a staff
-- member's own hours. A staff member with no hours of their own works the business's hours;
-- one with any hours of their own works exactly those, every other day off.

-- Lets GiST exclusion constraints compare plain values (uuids, numbers) for equality next to
-- ranges: here for overlapping hours, and later for overlapping bookings.
create extension if not exists btree_gist with schema extensions;

-- A span within a day. Postgres has no built-in range of times of day.
create type public.time_range as range (subtype = time);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Null for the business's own hours.
  staff_id uuid,
  -- 0 is Sunday, as in JavaScript's getDay() and Postgres's extract(dow ...).
  weekday smallint not null check (weekday between 0 and 6),
  -- In the business's local time. Closing at 24:00 means open until midnight; a span can't run
  -- past midnight into the next day.
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at),
  foreign key (staff_id, business_id)
    references public.staff (id, business_id) on delete cascade,
  -- One schedule's spans never overlap on the same day. coalesce, because rows with a null
  -- staff_id would otherwise never be compared with each other.
  exclude using gist (
    business_id with =,
    (coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
    weekday with =,
    (public.time_range(opens_at, closes_at)) with &&
  )
);

create index working_hours_staff_id on public.working_hours (staff_id);

alter table public.working_hours enable row level security;

grant select, insert, delete on public.working_hours to authenticated;

create policy "members can view their business's hours"
  on public.working_hours for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create policy "owners and admins can add hours"
  on public.working_hours for insert to authenticated
  with check (private.has_business_role(business_id, '{owner,admin}'));

create policy "owners and admins can remove hours"
  on public.working_hours for delete to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'));

-- Replaces one weekly schedule (the business's when target_staff_id is null or left out, else that
-- staff member's) with `spans`: [{"weekday": 1, "opens_at": "09:00", "closes_at": "17:00"}, ...].
-- Security invoker, so it runs under the caller's RLS, and one transaction: an overlapping or
-- invalid span leaves the old schedule untouched. An empty list for a staff member puts them
-- back on the business's hours.
create function public.set_working_hours(
  target_business_id uuid,
  spans jsonb,
  target_staff_id uuid default null
)
returns void
language sql
set search_path = ''
as $$
  delete from public.working_hours
  where business_id = target_business_id
    and staff_id is not distinct from target_staff_id;

  insert into public.working_hours (business_id, staff_id, weekday, opens_at, closes_at)
  select target_business_id, target_staff_id, span.weekday, span.opens_at, span.closes_at
  from jsonb_to_recordset(spans) as span(weekday smallint, opens_at time, closes_at time);
$$;

grant execute on function public.set_working_hours(uuid, jsonb, uuid) to authenticated;
