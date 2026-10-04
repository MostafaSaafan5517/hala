-- The check on businesses.timezone calls private.is_time_zone, which runs as whoever writes the
-- row. Only signed-in users could run it, so server code (the service role) couldn't create or
-- update a business at all, which seeding the demo and the assistant's tests need.
grant execute on function private.is_time_zone(text) to service_role;
