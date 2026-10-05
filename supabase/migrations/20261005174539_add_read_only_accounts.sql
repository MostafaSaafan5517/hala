-- Read-only accounts, for the public demo: they sign in and see everything their role allows, but
-- the database refuses every change they try, whatever the app does. An account is read-only when
-- its app_metadata says so (`{"read_only": true}`), which only the admin API (the service role)
-- can set. Server code acting with the service role, such as the assistant, isn't affected, so a
-- demo visitor can still chat with it.
--
-- One statement-level trigger per table: it runs once per statement, before any row changes, and
-- also covers writes made inside security definer functions (book_appointment, create_business),
-- because the caller's claims are still in place there. Every new table needs it too; a pgTAP test
-- fails when one doesn't have it.

create function private.refuse_read_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'read_only')::boolean, false) then
    raise exception 'This demo account is read-only' using errcode = 'HB010';
  end if;
  return null;
end;
$$;

do $$
declare
  target record;
begin
  for target in select tablename from pg_tables where schemaname = 'public' loop
    execute format(
      'create trigger read_only_accounts_cannot_write
         before insert or update or delete on public.%I
         for each statement execute function private.refuse_read_only()',
      target.tablename
    );
  end loop;
end;
$$;
