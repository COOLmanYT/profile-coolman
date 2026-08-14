-- All database access for this site goes through server-side routes using the
-- service-role key. Deny browser roles direct access to profile data and tokens.
alter table if exists public.views enable row level security;
alter table if exists public.toggles enable row level security;
alter table if exists public.twitch_oauth enable row level security;
alter table if exists public.site_settings enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['views', 'toggles', 'twitch_oauth', 'site_settings'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
      execute format('grant all on table public.%I to service_role', table_name);
    end if;
  end loop;

  -- The counter is invoked only by the server-side API route.
  if to_regprocedure('public.increment_profile_views()') is not null then
    revoke execute on function public.increment_profile_views() from public, anon, authenticated;
    grant execute on function public.increment_profile_views() to service_role;
  end if;
end $$;
