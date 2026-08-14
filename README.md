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
|---|---|
| `NEXTAUTH_URL` | Your site URL |
| `NEXTAUTH_SECRET` | Random secret for NextAuth |
| `DISCORD_CLIENT_ID` | Discord OAuth app client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth app client secret |
| `DISCORD_USER_ID` | Your Discord user ID (for Lanyard + auth) |
| `DISCORD_BOT_TOKEN` | Discord bot token (optional) |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `SPOTIFY_REFRESH_TOKEN` | Spotify refresh token (required scopes: `user-read-currently-playing`, `user-read-playback-state`) |
| `SPOTIFY_DEBUG` | Set to `true` to include upstream status codes in `/api/spotify` responses (for troubleshooting only; leave unset or `false` in production) |
| `TWITCH_CLIENT_ID` | Twitch Developer application client ID |
| `TWITCH_CLIENT_SECRET` | Twitch Developer application client secret |
| `TWITCH_BROADCASTER_LOGIN` | Twitch channel login (for example, `coolman_yt1`) |
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
- `spotify_embed`
- `spotify_playlist`
- `twitch`
- `twitch_stats`
- `discord_music`
- `discord_video`
- `discord_games`
- `discord_status`
- `discord_other`
- `discord_mobile`
- `discord_web`
- `discord_desktop`

## Connect Twitch

Register both `https://coolmanyt.com/api/twitch/callback` and `http://localhost:3000/api/twitch/callback` as OAuth redirect URLs in your Twitch Developer application. After setting `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, and `TWITCH_BROADCASTER_LOGIN`, sign in to the dashboard and select **Connect Twitch**. Approve the `moderator:read:followers` and `channel:read:subscriptions` scopes to display follower and subscriber totals.

## Avatar

Place your `avatar.png` in the `public/` folder.
