-- admin_stats — backend-wide counts for the /admin console.
--
-- SECURITY DEFINER so it can count across all rows, but it hard-gates on the
-- caller's verified auth email: only the owner account gets numbers, everyone
-- else is rejected. This is the REAL admin gate (the web allow-list is only UI).
--
-- Defensive by design: each table is counted only if it actually exists
-- (to_regclass), so this migration applies cleanly regardless of which tables
-- are present in a given environment. Add more counters the same way.

create or replace function public.admin_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'email', '');
  is_admin boolean := lower(caller_email) in ('arielbar18@gmail.com');
  n_profiles bigint := 0;
  n_units bigint := 0;
  n_providers bigint := 0;
  n_bookings bigint := 0;
  n_follows bigint := 0;
begin
  if not is_admin then
    raise exception 'admin_stats: not authorized';
  end if;

  if to_regclass('public.profiles') is not null then
    execute 'select count(*) from public.profiles' into n_profiles;
  end if;
  if to_regclass('public.units') is not null then
    execute 'select count(*) from public.units' into n_units;
  end if;
  if to_regclass('public.providers') is not null then
    execute 'select count(*) from public.providers' into n_providers;
  end if;
  if to_regclass('public.bookings') is not null then
    execute 'select count(*) from public.bookings' into n_bookings;
  end if;
  if to_regclass('public.follows') is not null then
    execute 'select count(*) from public.follows' into n_follows;
  end if;

  return json_build_object(
    'profiles', n_profiles,
    'units', n_units,
    'providers', n_providers,
    'bookings', n_bookings,
    'follows', n_follows
  );
end;
$$;

-- Callable by signed-in users; the body itself enforces the admin email, so a
-- non-admin call just errors out with no data leaked.
grant execute on function public.admin_stats() to anon, authenticated;
