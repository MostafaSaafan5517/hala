-- Who the users are, which businesses exist, and who works at each business.

create type public.member_role as enum ('owner', 'admin', 'staff');
-- The languages the assistant speaks.
create type public.language as enum ('en', 'ar');

-- RLS policies run as the calling user, so signed-in users need to reach the helpers in the
-- private schema. The schema is still not exposed through the API.
grant usage on schema private to authenticated;

-- True for a time zone name Postgres knows (an IANA name such as Africa/Cairo). Postgres also
-- accepts abbreviations and POSIX offsets after AT TIME ZONE, which don't follow daylight saving,
-- so a business's zone is checked against the named zones. Declared immutable so a check
-- constraint can use it; the list only changes when Postgres's time zone data is updated.
create function private.is_time_zone(zone text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = zone);
$$;

-- Check constraints run as the user making the change.
grant execute on function private.is_time_zone(text) to authenticated;

-- One row per signed-up user, created by the trigger below. auth.users is not readable through
-- the API, so names and emails shown in the app come from here.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 100),
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  -- Used in URLs (the dashboard now, the widget later), so it never changes.
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 50),
  -- Bookings are stored in UTC and shown, and offered, in the business's local time.
  timezone text not null check (private.is_time_zone(timezone)),
  -- What the assistant speaks until a customer writes in the other language.
  default_language public.language not null default 'en',
  created_at timestamptz not null default now()
);

-- The people who run a business. Customers are not here: they chat through the widget.
create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- References profiles, not auth.users, so the API can join a member row to a name.
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

-- Exactly one owner per business; ownership changes are a transfer, not a second owner.
create unique index business_members_one_owner on public.business_members (business_id)
  where role = 'owner';
create index business_members_user_id on public.business_members (user_id);

-- RLS on everywhere, with no policies yet: every row is hidden from the API roles until a
-- policy allows it.
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

-- Keep profiles in step with auth.users. Security definer because the trigger fires as
-- whichever role changed auth.users; search_path is empty so every name must be qualified.
create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trim and cap the name here rather than let the column check reject it, which would fail
  -- the whole sign-up.
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 100)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();

create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();

-- A business always keeps its owner. Users can't remove the owner's row (the delete policy), but
-- deleting a user cascades to their member rows, so deleting an owner's account would otherwise
-- leave the business with nobody in charge. Only deleting the business itself takes the owner's
-- row with it: by the time the cascade reaches the row, the business is already gone.
create function private.keep_business_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.businesses where id = old.business_id) then
    raise exception 'A business must keep its owner' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger keep_business_owner
  before delete on public.business_members
  for each row
  when (old.role = 'owner')
  execute function private.keep_business_owner();

-- True when the signed-in user works at the business with one of the given roles.
-- Security definer so it can read business_members without going through its own RLS;
-- otherwise the member policies, which call this function, would recurse into themselves.
create function private.has_business_role(
  target_business_id uuid,
  allowed_roles public.member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = target_business_id
      and user_id = (select auth.uid())
      and role = any (allowed_roles)
  );
$$;

grant execute on function private.has_business_role(uuid, public.member_role[]) to authenticated;

-- Businesses -------------------------------------------------------------------------------

-- The slug is part of URLs, so only the name, time zone and language can change.
grant select on public.businesses to authenticated;
grant update (name, timezone, default_language) on public.businesses to authenticated;

create policy "members can view their businesses"
  on public.businesses for select to authenticated
  using (private.has_business_role(id, '{owner,admin,staff}'));

create policy "owners and admins can edit their business"
  on public.businesses for update to authenticated
  using (private.has_business_role(id, '{owner,admin}'))
  with check (private.has_business_role(id, '{owner,admin}'));

-- Creating a business inserts the business and its owner in one transaction. Plain inserts
-- can't do this under RLS: the creator isn't a member until the second insert, so the first
-- one would have nothing to satisfy a policy.
create function public.create_business(
  business_name text,
  business_slug text,
  business_timezone text,
  business_language public.language
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator_id uuid := (select auth.uid());
  new_business_id uuid;
begin
  if creator_id is null then
    raise exception 'You must be signed in to create a business' using errcode = '42501';
  end if;

  insert into public.businesses (name, slug, timezone, default_language)
  values (business_name, business_slug, business_timezone, business_language)
  returning id into new_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (new_business_id, creator_id, 'owner');

  return new_business_id;
end;
$$;

grant execute on function public.create_business(text, text, text, public.language)
  to authenticated;

-- Business members -------------------------------------------------------------------------

grant select, insert, delete on public.business_members to authenticated;
grant update (role) on public.business_members to authenticated;

create policy "members can view their colleagues"
  on public.business_members for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

-- Owners add admins or staff; admins add staff. Nobody inserts an owner: only
-- create_business does that.
create policy "owners and admins can add members"
  on public.business_members for insert to authenticated
  with check (
    (role = 'staff' and private.has_business_role(business_id, '{owner,admin}'))
    or (role = 'admin' and private.has_business_role(business_id, '{owner}'))
  );

-- Only the owner changes roles. The owner's own row can't change (a business always keeps its
-- owner), and nobody can be promoted to owner.
create policy "owners can change roles"
  on public.business_members for update to authenticated
  using (role <> 'owner' and private.has_business_role(business_id, '{owner}'))
  with check (role <> 'owner');

-- Owners remove admins or staff, admins remove staff, and anyone except the owner can leave.
create policy "members can be removed or leave"
  on public.business_members for delete to authenticated
  using (
    role <> 'owner'
    and (
      private.has_business_role(business_id, '{owner}')
      or (role = 'staff' and private.has_business_role(business_id, '{admin}'))
      or user_id = (select auth.uid())
    )
  );

-- Profiles ---------------------------------------------------------------------------------

-- Email comes from auth and is synced by trigger; users edit only their name.
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- One policy per action: Postgres evaluates every permissive policy for each row, so merging
-- them keeps the check to a single pass.
create policy "users can view their own and their colleagues' profiles"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.business_members
      where business_members.user_id = profiles.id
        and private.has_business_role(business_members.business_id, '{owner,admin,staff}')
    )
  );

create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
