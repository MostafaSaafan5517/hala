-- The people who book appointments. Each business has its own customers, known by phone number:
-- in the markets Hala serves the phone (and WhatsApp) is how a business reaches people, and it's
-- what a customer gives over the phone or in a chat. Customers are created when they first book
-- (by the booking functions, never directly through the API).

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- E.164: a plus, the country code and the number, digits only (+201012345678). The app checks
  -- the number is valid for its country; the database keeps the shape.
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+$'),
  -- The language to answer them in.
  language public.language not null,
  created_at timestamptz not null default now(),
  -- One customer per phone number in each business.
  unique (business_id, phone),
  -- Lets bookings reference (customer, business) together.
  unique (id, business_id)
);

alter table public.customers enable row level security;

grant select on public.customers to authenticated;

create policy "members can view their business's customers"
  on public.customers for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create trigger record_audit_log
  after insert or update or delete on public.customers
  for each row execute function private.record_audit_log('id');
