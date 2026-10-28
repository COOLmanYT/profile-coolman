begin;

-- Only aggregate activity from this point forward. Do not invent historic views
-- or reset lifetime totals. No browser hashes, IPs or user agents are copied.
create table public.profile_statistics_state (
  id text primary key check (id = 'profile'),
  started_at timestamptz not null default statement_timestamp()
);
insert into public.profile_statistics_state (id) values ('profile');

create table public.profile_statistics_daily (
  day date primary key,
  views bigint not null default 0 check (views >= 0),
  likes bigint not null default 0 check (likes >= 0)
);

alter table public.profile_statistics_state enable row level security;
alter table public.profile_statistics_daily enable row level security;
revoke all on public.profile_statistics_state, public.profile_statistics_daily from public, anon, authenticated;
grant select on public.profile_statistics_state to service_role;
grant select, insert, update on public.profile_statistics_daily to service_role;

create function public.record_profile_statistics()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  view_delta bigint := 0;
  like_delta bigint := 0;
begin
  if tg_table_name = 'views' then
    if new.id <> 'profile' then return new; end if;
    if tg_op = 'INSERT' then
      view_delta := new.count;
    else
      view_delta := greatest(0, new.count - old.count);
    end if;
  else
    -- The existing unique browser key makes repeated likes a no-op. This fires
    -- only for an actual insertion, in the same transaction as the lifetime total.
    like_delta := 1;
  end if;
  if view_delta > 0 or like_delta > 0 then
    insert into public.profile_statistics_daily (day, views, likes)
      values ((statement_timestamp() at time zone 'UTC')::date, view_delta, like_delta)
      on conflict (day) do update set
        views = public.profile_statistics_daily.views + excluded.views,
        likes = public.profile_statistics_daily.likes + excluded.likes;
  end if;
  return new;
end;
$$;
revoke execute on function public.record_profile_statistics() from public, anon, authenticated;
grant execute on function public.record_profile_statistics() to service_role;

create trigger profile_views_statistics
  after insert or update of count on public.views
  for each row execute function public.record_profile_statistics();
create trigger profile_likes_statistics
  after insert on public.profile_likes
  for each row execute function public.record_profile_statistics();

-- One bounded database request, evaluated from a consistent snapshot. Direct
-- browser roles cannot read history or execute this function.
create function public.get_profile_statistics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_days not in (7, 30, 90) or p_days is null then
    raise exception 'Unsupported statistics range';
  end if;
  select jsonb_build_object(
    'trackedSince', to_char(state.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'generatedAt', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'totals', jsonb_build_object(
      'views', coalesce((select count from public.views where id = 'profile'), 0),
      'likes', coalesce((select count from public.profile_like_totals where id = 'profile'), 0)
    ),
    'daily', (
      select jsonb_agg(jsonb_build_object(
        'date', to_char(dates.day, 'YYYY-MM-DD'),
        'views', case when dates.day < (state.started_at at time zone 'UTC')::date then null else coalesce(daily.views, 0) end,
        'likes', case when dates.day < (state.started_at at time zone 'UTC')::date then null else coalesce(daily.likes, 0) end
      ) order by dates.day)
      from (select (statement_timestamp() at time zone 'UTC')::date - (p_days * 2 - 1) + n as day from generate_series(0, p_days * 2 - 1) as n) dates
      left join public.profile_statistics_daily daily on daily.day = dates.day
    )
  ) into result
  from public.profile_statistics_state state where state.id = 'profile';
  return result;
end;
$$;
revoke execute on function public.get_profile_statistics(integer) from public, anon, authenticated;
grant execute on function public.get_profile_statistics(integer) to service_role;

commit;
