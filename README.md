# COOLman Profile Site

A Next.js 14 profile site with Spotify now-playing, Discord presence, and a dashboard for toggling widgets.

## Features

- 🎵 Spotify now-playing widget (polls every 30s)
- 🎮 Discord presence via [Lanyard API](https://github.com/Phineas/lanyard)
- 👁 View counter via Supabase
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
| `SPOTIFY_REFRESH_TOKEN` | Spotify refresh token |
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

## Avatar

Place your `avatar.png` in the `public/` folder.
