begin;

-- Add breakdowns to the existing statistics. Store independent daily buckets,
-- never an event log, IP, raw user agent, full URL or visitor identifier.
create table public.profile_statistics_dimensions (
  day date not null,
  dimension text not null check (dimension in ('country','hour','referrer','outbound','device','os','browser')),
  value text not null check (length(value) between 1 and 253),
  count bigint not null default 0 check (count >= 0),
  primary key (day, dimension, value)
);
alter table public.profile_statistics_dimensions enable row level security;
revoke all on public.profile_statistics_dimensions from public, anon, authenticated;
grant select, insert, update on public.profile_statistics_dimensions to service_role;
alter table public.profile_statistics_state add column dimensions_started_at timestamptz not null default statement_timestamp();

create function public.record_profile_statistics_dimensions(p_dimensions jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  item record;
  bucket text;
  bucket_limit integer;
  today date := (statement_timestamp() at time zone 'UTC')::date;
begin
  if p_dimensions is null or jsonb_typeof(p_dimensions) <> 'object' then
    raise exception 'Invalid statistics dimensions';
  end if;
  if (select count(*) from jsonb_object_keys(p_dimensions)) > 7 then raise exception 'Invalid statistics dimensions'; end if;
  for item in select key, value from jsonb_each_text(p_dimensions) loop
    if item.key not in ('country','hour','referrer','outbound','device','os','browser') or item.value is null or length(item.value) not between 1 and 253 or item.value !~ '^[A-Za-z0-9 .:/_-]+$' then
      raise exception 'Invalid statistics dimension';
    end if;
    if item.key = 'hour' and item.value !~ '^(0[0-9]|1[0-9]|2[0-3])$' then raise exception 'Invalid hour'; end if;
    bucket := item.value;
    bucket_limit := case when item.key = 'country' then 256 when item.key = 'hour' then 24 else 100 end;
    -- Serialize admission per day/category so hostile referrers cannot create
    -- unlimited rows. Excess values share the Other bucket.
    perform pg_advisory_xact_lock(hashtextextended('profile-statistics:' || today::text || ':' || item.key, 0));
    if not exists (select 1 from public.profile_statistics_dimensions where day=today and dimension=item.key and value=bucket)
      and (select count(*) from public.profile_statistics_dimensions where day=today and dimension=item.key) >= bucket_limit then bucket := 'Other'; end if;
    insert into public.profile_statistics_dimensions(day,dimension,value,count) values(today,item.key,bucket,1)
      on conflict(day,dimension,value) do update set count=public.profile_statistics_dimensions.count+1;
  end loop;
end;
$$;
revoke execute on function public.record_profile_statistics_dimensions(jsonb) from public, anon, authenticated;
grant execute on function public.record_profile_statistics_dimensions(jsonb) to service_role;

-- The view and its breakdowns succeed or roll back together. The existing
-- view cookie and daily-history trigger continue to determine counted views.
create function public.increment_profile_views_with_dimensions(p_dimensions jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare total integer;
begin
  total := public.increment_profile_views();
  perform public.record_profile_statistics_dimensions(p_dimensions);
  return total;
end;
$$;
revoke execute on function public.increment_profile_views_with_dimensions(jsonb) from public, anon, authenticated;
grant execute on function public.increment_profile_views_with_dimensions(jsonb) to service_role;

-- Preserve the existing date-range reader and extend its response. The wrapper
-- remains compatible with the already-deployed view/like statistics UI.
alter function public.get_profile_statistics(integer,date,date) rename to get_profile_statistics_totals;
create function public.get_profile_statistics(p_days integer default 30, p_start date default null, p_end date default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare stats jsonb;
begin
  stats := public.get_profile_statistics_totals(p_days,p_start,p_end);
  if stats is null then return null; end if;
  return stats || jsonb_build_object('breakdowns', jsonb_build_object(
    'startedAt', (select to_char(dimensions_started_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.profile_statistics_state where id='profile'),
    'categories', (
      with counts as (
        select dimension,value,sum(count)::bigint as count from public.profile_statistics_dimensions
        where day between (stats->'range'->>'start')::date and (stats->'range'->>'end')::date group by dimension,value
      ) select jsonb_object_agg(category, jsonb_build_object(
        'total',coalesce((select sum(count) from counts where dimension=category),0),
        'rows',coalesce((select jsonb_agg(jsonb_build_object('value',value,'count',count) order by count desc,value) from (
          select value,count from counts where dimension=category order by count desc,value limit case when category='hour' then 24 else 20 end
        ) ranked),'[]'::jsonb)
      )) from unnest(array['country','hour','referrer','outbound','device','os','browser']) as category
    )
  ));
end;
$$;
revoke execute on function public.get_profile_statistics(integer,date,date) from public, anon, authenticated;
grant execute on function public.get_profile_statistics(integer,date,date) to service_role;

commit;
