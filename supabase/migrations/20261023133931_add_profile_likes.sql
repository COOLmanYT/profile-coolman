-- Additive: no existing profile data or settings are changed.
create table public.profile_likes (
  browser_hash text primary key check (browser_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create table public.profile_like_totals (
  id text primary key check (id = 'profile'),
  count bigint not null default 0 check (count >= 0)
);
insert into public.profile_like_totals (id, count) values ('profile', 0);
alter table public.profile_likes enable row level security;
alter table public.profile_like_totals enable row level security;
revoke all on public.profile_likes, public.profile_like_totals from public, anon, authenticated;
grant select, insert on public.profile_likes to service_role;
grant select, update on public.profile_like_totals to service_role;

create function public.like_profile_once(p_browser_hash text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total bigint;
  was_added boolean;
begin
  -- Serialize concurrent submissions, including retries from the same browser.
  select count into strict total from public.profile_like_totals where id = 'profile' for update;
  insert into public.profile_likes (browser_hash) values (p_browser_hash) on conflict do nothing;
  was_added := found;
  if was_added then
    update public.profile_like_totals set count = count + 1 where id = 'profile' returning count into total;
  end if;
  return jsonb_build_object('count', total, 'added', was_added);
end;
$$;
revoke execute on function public.like_profile_once(text) from public, anon, authenticated;
grant execute on function public.like_profile_once(text) to service_role;
