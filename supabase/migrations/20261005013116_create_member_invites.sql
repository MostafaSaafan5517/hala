-- Invite links: how owners and admins add people to their business. The owner or admin picks a
-- role and gets a link to share however they like; whoever opens it while signed in joins with
-- that role. It works without sending email, and unlike "add by email" it can't be used to find out
-- whether an address has an account. Each link carries a random token; only the token's SHA-256
-- hash is stored (like a password), so the table never holds a usable link.

create table public.member_invites (
  id uuid primary key default gen_random_uuid(),
  -- Pure access rows, like business_members: they go with the business.
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- A business has exactly one owner, made by create_business; nobody is invited as one.
  role public.member_role not null check (role <> 'owner'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Not granted to users: always the person who made the invite.
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz
);

create index member_invites_business_id on public.member_invites (business_id);

alter table public.member_invites enable row level security;

-- The hash is never read back; users only write it, and only the database compares it.
grant select (id, business_id, role, created_by, created_at, expires_at, accepted_by, accepted_at)
  on public.member_invites to authenticated;
grant insert (business_id, role, token_hash) on public.member_invites to authenticated;
grant delete on public.member_invites to authenticated;

create policy "owners and admins see their business's invites"
  on public.member_invites for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'));

-- The same rule as adding members directly: owners invite admins or staff, admins invite staff.
create policy "owners invite admins or staff; admins invite staff"
  on public.member_invites for insert to authenticated
  with check (
    (role = 'staff' and private.has_business_role(business_id, '{owner,admin}'))
    or (role = 'admin' and private.has_business_role(business_id, '{owner}'))
  );

-- Revoking a link that's been used would change nothing, so used ones stay as a record.
create policy "owners and admins revoke unused invites they could make"
  on public.member_invites for delete to authenticated
  using (
    accepted_at is null
    and (
      private.has_business_role(business_id, '{owner}')
      or (role = 'staff' and private.has_business_role(business_id, '{admin}'))
    )
  );

create trigger record_audit_log
  after insert or update or delete on public.member_invites
  for each row execute function private.record_audit_log('id');

-- What a link offers, for the page that accepts it: anyone holding a valid link may see which
-- business and role it's for (the token is the secret). Nothing comes back for a link that's
-- unknown, used or expired.
create function public.member_invite_details(invite_token text)
returns table (business_name text, role public.member_role, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select businesses.name, member_invites.role, member_invites.expires_at
  from public.member_invites
  join public.businesses on businesses.id = member_invites.business_id
  where member_invites.token_hash = encode(sha256(convert_to(invite_token, 'UTF8')), 'hex')
    and member_invites.accepted_at is null
    and member_invites.expires_at > now();
$$;

grant execute on function public.member_invite_details(text) to authenticated;

-- Joins the signed-in user to the invite's business with its role, once. Security definer
-- because the user isn't a member yet, so no policy would let them add themselves; the token is
-- the permission. Returns the business's slug.
create function public.accept_member_invite(invite_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invite public.member_invites;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to accept an invite' using errcode = '42501';
  end if;

  -- Locked, so two people racing for the same link can't both use it.
  select * into v_invite
  from public.member_invites
  where token_hash = encode(sha256(convert_to(invite_token, 'UTF8')), 'hex')
  for update;
  if not found or v_invite.accepted_at is not null or v_invite.expires_at <= now() then
    raise exception 'This invite link is invalid, used or expired' using errcode = 'P0002';
  end if;

  -- Leaves the link unused, so it can still go to the person it was meant for.
  if exists (
    select 1 from public.business_members
    where business_id = v_invite.business_id and user_id = v_user_id
  ) then
    raise exception 'You already work at this business' using errcode = '23505';
  end if;

  insert into public.business_members (business_id, user_id, role)
  values (v_invite.business_id, v_user_id, v_invite.role);
  update public.member_invites
  set accepted_by = v_user_id, accepted_at = now()
  where id = v_invite.id;

  return (select slug from public.businesses where id = v_invite.business_id);
end;
$$;

grant execute on function public.accept_member_invite(text) to authenticated;
