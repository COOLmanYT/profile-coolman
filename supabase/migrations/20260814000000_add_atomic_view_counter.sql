create or replace function increment_profile_views()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  insert into views (id, count) values ('profile', 1)
  on conflict (id) do update set count = views.count + 1
  returning count into next_count;
  return next_count;
end;
$$;
