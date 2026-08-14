create table if not exists public.site_settings (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
