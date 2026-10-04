-- Appointments. The database itself guarantees that a staff member is never booked twice at the
-- same time: an exclusion constraint refuses any confirmed booking whose time overlaps another
-- confirmed booking of the same staff member, however many requests race for the slot. Nothing
-- writes bookings through the API, not even server code: the booking functions (next) are the
-- only way in, and they apply the business's rules first.

create type public.booking_status as enum ('confirmed', 'cancelled');

-- A short code customers can quote ("booking 7KQ2MX"): six characters from an alphabet without
-- look-alikes (no 0/O, 1/I), so it survives being read out over the phone. 32 symbols, so each
-- random byte maps to one without bias; 32^6 is about a billion codes per business.
create function private.new_booking_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', get_byte(bytes, position) % 32 + 1, 1),
    '' order by position
  )
  from extensions.gen_random_bytes(6) as bytes, generate_series(0, 5) as position;
$$;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Unique within the business. A collision (about one in a billion per booking) fails the
  -- booking safely, and retrying draws a new code.
  reference text not null default private.new_booking_reference()
    check (reference ~ '^[2-9A-HJ-NP-Z]{6}$'),
  customer_id uuid not null,
  service_id uuid not null,
  staff_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- ends_at plus the service's buffer: the staff member is busy until then.
  blocked_until timestamptz not null,
  status public.booking_status not null default 'confirmed',
  -- The price when it was booked, so a later price change doesn't rewrite past bookings.
  price integer not null check (price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_at > starts_at),
  check (blocked_until >= ends_at),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  unique (business_id, reference),
  -- A booking can only join a customer, service and staff member of its own business.
  foreign key (customer_id, business_id) references public.customers (id, business_id),
  foreign key (service_id, business_id) references public.services (id, business_id),
  foreign key (staff_id, business_id) references public.staff (id, business_id),
  -- No double bookings. Ranges are half-open ([start, end)), so back-to-back bookings are fine.
  -- btree_gist lets the GiST index compare staff_id for equality next to the range overlap.
  -- Cancelled bookings don't count, so cancelling frees the time.
  constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, blocked_until) with &&
  ) where (status = 'confirmed')
);

-- The day view, and a customer's bookings. Overlap checks use the constraint's GiST index.
create index bookings_business_id_starts_at on public.bookings (business_id, starts_at);
create index bookings_customer_id on public.bookings (customer_id);

alter table public.bookings enable row level security;

grant select on public.bookings to authenticated;
-- Server code (the assistant's tools) books through the same functions as everyone else.
revoke all on public.bookings from service_role;
grant select on public.bookings to service_role;

create policy "members can view their business's bookings"
  on public.bookings for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create trigger record_audit_log
  after insert or update or delete on public.bookings
  for each row execute function private.record_audit_log('id');
