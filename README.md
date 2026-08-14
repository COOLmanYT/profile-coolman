# COOLman Profile Site

A Next.js profile site with advanced Spotify mini-player, rich Discord presence, and a dashboard for toggling widgets.

## Features

- 🎵 Spotify mini-player (album art, artists, duration/progress, paused state, responsive embed)
- 🎮 Discord presence via [Lanyard API](https://github.com/Phineas/lanyard) with profile/avatar/status details
- 📺 Twitch live widget with live viewers, followers, and subscribers
- 👁 View counter via Supabase (counts once per browser every 24h, not on every refresh)
- 🔒 Dashboard with Discord OAuth (NextAuth.js) — only allowed user can access
- 🎛 Toggle controls for Spotify and Discord widget categories
- 🥚 Easter egg: type `rm -rf /` on the page
- 🔗 Social links: Website, YouTube, Ko-fi, GitHub, Discord, Roblox

## Getting Started

1. Copy `.env.example` to `.env.local` and fill in values
2. `npm install`
3. `npm run dev`

## Environment Variables

| Variable | Description |
| --- | --- |
| `NEXTAUTH_URL` | Your site URL |
| `NEXTAUTH_SECRET` | Random secret for NextAuth |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Support address shown on legal pages (defaults to `support@coolmanyt.com`) |
| `DISCORD_CLIENT_ID` | Discord OAuth app client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth app client secret |
| `DISCORD_USER_ID` | Your Discord user ID (for Lanyard + auth) |
| `DISCORD_BOT_TOKEN` | Discord bot token (optional) |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `SPOTIFY_REFRESH_TOKEN` | Spotify refresh token (required scopes: `user-read-currently-playing`, `user-read-playback-state`, `user-read-recently-played`) |
| `SPOTIFY_DEBUG` | Set to `true` to include upstream status codes in `/api/spotify` responses (for troubleshooting only; leave unset or `false` in production) |
| `TWITCH_CLIENT_ID` | Twitch Developer application client ID |
| `TWITCH_CLIENT_SECRET` | Twitch Developer application client secret |
| `TWITCH_BROADCASTER_LOGIN` | Twitch channel login (for example, `coolman_yt1`) |
| `TWITCH_REDIRECT_URI` | Exact public Twitch OAuth callback URL |
| `TWITCH_REFRESH_TOKEN` | Optional fallback Twitch user refresh token; connect via the dashboard instead when Supabase is configured |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

## Supabase Schema

```sql
-- View counter
create table views (
  id text primary key,
  count integer default 0
);

-- Atomic view increment used by /api/views.
-- This prevents simultaneous visitors from overwriting each other's views.
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

-- Widget toggles
create table toggles (
  id text primary key,
  value boolean default true,
  updated_at timestamptz default now()
);

-- Twitch OAuth tokens (created by supabase/migrations/20260814000001_add_twitch_oauth.sql)
create table twitch_oauth (
  id text primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);
```

Recommended toggle IDs include:

- `spotify`
- `spotify_widget`
- `spotify_position`
- `spotify_embed`
- `spotify_playlist`
- `spotify_history`
- `twitch`
- `twitch_profile`
- `twitch_stats`
- `twitch_live`
- `twitch_schedule`
- `discord`
- `discord_profile`
- `discord_banner`
- `discord_badges`
- `discord_decoration`
- `discord_devices`
- `discord_music`
- `discord_video`
- `discord_games`
- `discord_status`
- `discord_other`
- `discord_mobile`
- `discord_web`
- `discord_desktop`

## Connect Twitch

Set `TWITCH_REDIRECT_URI` to the exact public URL of this profile deployment. Register that same URL in your Twitch Developer application, for example `https://profile.coolmanyt.com/api/twitch/callback`, plus `http://localhost:3000/api/twitch/callback` for local development. In Vercel, set `TWITCH_BROADCASTER_LOGIN=coolman_yt1` as well as the Twitch client credentials and redirect URI. After setting these values, sign in to the dashboard and select **Connect Twitch**. Approve the `moderator:read:followers` and `channel:read:subscriptions` scopes to display follower and subscriber totals.

The Dashboard reports whether Twitch is configured and connected. The public Twitch endpoint is cached for 25 seconds to keep API use bounded when multiple visitors load the profile.

## Quality checks

Run `npm run lint`, `npm test`, `npx tsc --noEmit`, and `npm run audit` before deploying.

## Seasonal themes

Apply `supabase/migrations/20260814000002_add_site_settings.sql` before using the Dashboard seasonal controls. The profile automatically celebrates Christmas (including an Australia-aware sandman), Halloween, Easter, New Year, and 28 November. Visitors can choose a one-visit or timed override in **Options**; Dashboard controls manage automatic events and a location-scoped global event schedule.

## Security

Apply `supabase/migrations/20260814000003_secure_public_tables.sql` to enable row-level security and remove direct browser-role access to profile data. The site accesses these tables only through server routes using the service-role key.

## Avatar

Place your `avatar.png` in the `public/` folder.
