# COOLman Profile Site

A Next.js profile site with advanced Spotify mini-player, rich Discord presence, and a dashboard for toggling widgets.

## Features

- 🎵 Spotify mini-player (album art, artists, duration/progress, paused state, responsive embed)
- 🎮 Discord presence via [Lanyard API](https://github.com/Phineas/lanyard) with profile/avatar/status details
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

-- Widget toggles
create table toggles (
  id text primary key,
  value boolean default true,
  updated_at timestamptz default now()
);
```

Recommended toggle IDs include:
- `spotify`
- `spotify_embed`
- `spotify_playlist`
- `discord_music`
- `discord_video`
- `discord_games`
- `discord_status`
- `discord_other`

## Avatar

Place your `avatar.png` in the `public/` folder.
