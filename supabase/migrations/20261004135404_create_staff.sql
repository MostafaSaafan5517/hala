-- The people customers book with, and which services each of them performs. Staff here are
-- bookable people, separate from app accounts (business_members): a stylist needn't sign in.

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- One name, in whichever script the person writes it.
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Archived, not deleted, because bookings will point at staff.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Lets other tables reference (staff, business) together.
  unique (id, business_id)
);

create index staff_business_id on public.staff (business_id);

alter table public.services add unique (id, business_id);

-- Who performs which service. The composite foreign keys make it impossible for a row to join a
-- staff member of one business to a service of another.
create table public.staff_services (
  business_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  primary key (staff_id, service_id),
  foreign key (staff_id, business_id)
    references public.staff (id, business_id) on delete cascade,
  foreign key (service_id, business_id)
    references public.services (id, business_id) on delete cascade
);

create index staff_services_service_id on public.staff_services (service_id);

alter table public.staff enable row level security;
alter table public.staff_services enable row level security;

grant select on public.staff to authenticated;
grant insert (business_id, name) on public.staff to authenticated;
grant update (name, active) on public.staff to authenticated;

create policy "members can view their business's staff"
  on public.staff for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create policy "owners and admins can add staff"
  on public.staff for insert to authenticated
  with check (private.has_business_role(business_id, '{owner,admin}'));

create policy "owners and admins can edit staff"
  on public.staff for update to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'))
  with check (private.has_business_role(business_id, '{owner,admin}'));

grant select, insert, delete on public.staff_services to authenticated;

create policy "members can view who performs which service"
  on public.staff_services for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create policy "owners and admins can assign services"
  on public.staff_services for insert to authenticated
  with check (private.has_business_role(business_id, '{owner,admin}'));

create policy "owners and admins can unassign services"
  on public.staff_services for delete to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'));

-- Replaces a staff member's services with exactly `service_ids`. Security invoker, so it runs
-- under the caller's RLS (only owners and admins can change anything), and one transaction, so
-- a failure leaves the old set untouched.
create function private.replace_staff_services(target_staff_id uuid, service_ids uuid[])
returns void
language sql
set search_path = ''
as $$
  delete from public.staff_services
  where staff_id = target_staff_id and service_id <> all (service_ids);

  insert into public.staff_services (business_id, staff_id, service_id)
  select staff.business_id, staff.id, service_id
  from public.staff, unnest(service_ids) as service_id
  where staff.id = target_staff_id
  on conflict do nothing;
$$;

grant execute on function private.replace_staff_services(uuid, uuid[]) to authenticated;

-- Adds a staff member with the services they perform, in one transaction under the caller's
-- RLS. Returns the new staff member's id.
create function public.create_staff_member(
  target_business_id uuid,
  member_name text,
  service_ids uuid[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_staff_id uuid;
begin
  insert into public.staff (business_id, name)
  values (target_business_id, member_name)
  returning id into new_staff_id;
  perform private.replace_staff_services(new_staff_id, service_ids);
  return new_staff_id;
end;
$$;

-- Renames a staff member and replaces their services, in one transaction under the caller's
-- RLS. Returns false when the caller can't change that staff member (or it doesn't exist).
create function public.update_staff_member(
  target_staff_id uuid,
  member_name text,
  service_ids uuid[]
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.staff set name = member_name where id = target_staff_id;
  if not found then
    return false;
  end if;
  perform private.replace_staff_services(target_staff_id, service_ids);
  return true;
end;
$$;

grant execute on function public.create_staff_member(uuid, text, uuid[]) to authenticated;
grant execute on function public.update_staff_member(uuid, text, uuid[]) to authenticated;
