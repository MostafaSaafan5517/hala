-- What a business offers: each service has a name in English, Arabic or both, how long it takes,
-- a buffer after it, and a price.

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name_en text check (char_length(btrim(name_en)) between 1 and 80),
  name_ar text check (char_length(btrim(name_ar)) between 1 and 80),
  -- In 5-minute steps, up to 12 hours: availability is offered on that grid.
  duration_minutes integer not null
    check (duration_minutes between 5 and 720 and duration_minutes % 5 = 0),
  -- Time kept free after each appointment (cleaning up, resetting a room).
  buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 240 and buffer_minutes % 5 = 0),
  -- In the currency's smallest unit (piasters, halalas, fils): never a float.
  price integer not null check (price >= 0),
  -- ISO 4217 code. The number of decimals comes from the currency (2 for EGP, 3 for KWD).
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Services are archived, not deleted, because bookings will point at them.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- A business that works in one language needs only that name.
  check (name_en is not null or name_ar is not null)
);

create index services_business_id on public.services (business_id);

alter table public.services enable row level security;

grant select on public.services to authenticated;
grant insert (business_id, name_en, name_ar, duration_minutes, buffer_minutes, price, currency)
  on public.services to authenticated;
grant update (name_en, name_ar, duration_minutes, buffer_minutes, price, currency, active)
  on public.services to authenticated;

create policy "members can view their business's services"
  on public.services for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create policy "owners and admins can add services"
  on public.services for insert to authenticated
  with check (private.has_business_role(business_id, '{owner,admin}'));

create policy "owners and admins can edit services"
  on public.services for update to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'))
  with check (private.has_business_role(business_id, '{owner,admin}'));
