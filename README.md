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

### Live presence and request budget

Spotify and Discord share one browser connection to `wss://api.lanyard.rest/socket` per visible page. The existing `DISCORD_USER_ID` configuration is discovered through `/api/discord`; no new environment variable or exposed Spotify credential is needed. Lanyard supplies the song ID, artwork and timestamps. The progress bar advances locally, and ended/disconnected presence is discarded. Discord must expose Spotify presence for live updates; Spotify playback remains a fallback when that data is absent.

- `/api/discord` bootstraps the connection and syncs saved Discord achievement estimates once per minute. Its successful public response has a 15-second CDN cache. A cached REST song never replaces a newer socket song.
- Spotify playback polls every 60 seconds only without usable Lanyard song data. Optional playlist context refreshes every five minutes while live and only attaches to the matching song. Successful public playback is coalesced for 15 seconds per running instance and cached at the CDN for 15 seconds; this is not a strict global request cap. Responses carry a timestamp so progress accounts for cache age.
- Listening history starts only when expanded and refreshes every three minutes. History responses and errors remain `no-store` and never enter the CDN cache.
- Hidden pages disconnect and abort requests. Socket reconnects use capped exponential backoff with jitter; stalled handshakes time out. Spotify 429 responses stop additional upstream calls in the same function instance until `Retry-After` expires, including across playback/history endpoints. Browser polling also honours cooldowns across visibility changes. Multiple function instances still have independent cooldowns.

CDN hits still count as Vercel edge requests. Verify actual cache headers/hits and provider behaviour on the deployed preview before making production cost or latency claims.

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

## YouTube widget

The YouTube section compares dated uploads from the channel feed and selected channel tabs across all formats, including Shorts, regular videos and stream uploads. Channel tabs can supply the latest upload when RSS is unavailable or delayed. It includes the thumbnail, title, publication date and view count, plus subscribers, total channel views, public video count, last upload date and live status. Uploads and totals refresh from YouTube at most every 15 minutes; live status refreshes every minute while the page is visible. Failed or unrecognized responses display unavailable data rather than zero counts or a guessed offline status. A response with unavailable uploads is not cached by the public API.

The Dashboard controls the entire `youtube` module and its `youtube_stats`, `youtube_latest` and `youtube_live` sections. `youtube_shorts` and `youtube_videos` allow either or both upload types. Visitor **Options → Media preferences** offers browser-saved controls and a Shorts-only, Videos-only or both selector; global format restrictions take priority. Format selection uses the channel's selected Shorts/Videos/Live tabs, including uploads older than the RSS feed window. **Hide modules for this visit** provides a temporary override.

`youtube_embed_default` defaults to false and controls the initial player preference for visitors. Each visitor can follow that default or explicitly turn the player on/off. The enabled player first checks YouTube oEmbed availability, then loads a fixed privacy-enhanced iframe URL with no autoplay. Provider HTML is never injected. Embedding permission, browser restrictions or playback errors can still prevent playback; the YouTube watch link remains available.

Public YouTube pages supply channel totals by default. Optionally set the server-only `YOUTUBE_API_KEY` with YouTube Data API v3 enabled for [official channel statistics](https://developers.google.com/youtube/v3/docs/channels/); public pages remain the fallback. Subscriber counts can be rounded or hidden by YouTube. No API key is sent to the browser. YouTube page changes or consent screens may make individual fields unavailable while the rest of the widget continues to work.

## Profile likes

Apply `supabase/migrations/20261023133931_add_profile_likes.sql` to add the service-only like tables and atomic `like_profile_once` function. The public API keeps a random browser UUID in a rolling 400-day HttpOnly cookie and local storage, storing only its hash server-side. A unique key and serialized counter update prevent duplicate/retried submissions from incrementing twice. Local storage and the cookie restore each other, while browser Web Locks coordinate first-use identity creation across tabs. Clearing both storage mechanisms, browser eviction or changing browsers can allow another like; this does not claim to identify a person or prevent deliberate token forgery.

The heart button sits opposite the view count in normal layout beneath the status module, with space above the footer. A successful new like plays a brief heart animation, respecting reduced-motion preferences. Failed storage requests are reported unavailable and never presented as a successful like or a fabricated zero count.

## Discord achievement badges

The Discord widget supports all ten tiers of the new **Account Age**, **Game Time**, **Game Variety**, and **Streaming** badges, using Discord-hosted artwork. Existing Nitro, Server Booster, Quest, Orbs, and Gifting badges remain visible.

Update the `DISCORD_BADGE_DEFAULTS` variables near the top of [`lib/discord-achievements.ts`](lib/discord-achievements.ts) for manual updates without a database or Lanyard setup. Set `discord_game_time_hours`, `discord_games_played`, and `discord_streaming_hours` to your totals from Discord's Badge Directory. `null` allows observed game estimates when available; `0` hides that badge. Changes take effect after deploying the updated code.

Game Time and Game Variety can also use **estimates from observed Playing activities**. The server saves aggregate playing time and distinct application IDs in the existing, private `site_settings` table under `discord_activity_estimates:v2:<DISCORD_USER_ID>`. No schema migration is required. The current counter imports the legacy owner row once, then uses its own versioned row so older preview tabs cannot overwrite it. Older snapshot requests cannot reset a newer period. A revision check prevents concurrent visitors/server instances from counting the same time twice, and requests are coalesced for 15 seconds per server instance. Storage failures leave presence available and fall back to manual values.

An ongoing game's start timestamp can backfill up to 24 hours; later observations add only time beyond the shared watermark. Concurrent games count as one interval of wall time. Without a valid timestamp, only observations of the same game at most 90 seconds apart add time. Offline or empty activity observations add no playing time and close the backfill window, so later session timestamps cannot recount earlier observed gaps. Tracking runs when the profile is visited/polled, so finished sessions between visits are missed. Playing activities can also represent non-game applications; these totals are estimates of observed activity, not Discord's official counters. Application IDs deduplicate different experiences within platforms such as Roblox. Tooltips label automatically selected tiers **Estimated**.

The supplied Badge Directory screenshots confirm **Streaming: Breakout (23 hours)**, **Game Variety: Dabbler (8 games)**, and **Game Time: Recreational (5 hours)**. These values now seed the profile. Streaming stays at the confirmed manual total until updated. Game Variety uses `discord_games_played_minimum: 8` as a known minimum: observed unique applications can raise it once they exceed 8, but are not added blindly because the historical game identities are unknown.

`discord_game_time_baseline_hours` is set to `5`; observed hours after `discord_game_time_baseline_at` (`2026-10-23T09:54:43.000Z`, when their progress was recorded) are added to it. On the first poll after deploying a new snapshot, older estimated hours are replaced while known application IDs are retained. An ongoing session cannot backfill time before the snapshot. To recalibrate later, update both the known hours and snapshot timestamp. Set the manual total to `null` to use this baseline plus the automatic counter. The snapshot timestamp is a local configuration value shared by the server tracker and badge display, so changing it requires deployment. A non-null manual total or Lanyard KV override takes precedence, including `0` to hide a badge. Streaming remains manual because Discord's live Streaming activity can describe a Twitch broadcast and does not prove screen sharing to another person.

`DISCORD_BADGE_ORDER` follows the supplied profile screenshot: Nitro, Gifting, Quest, Booster, HypeSquad Brilliance, Account Age, Streaming, Game Variety (controller), Game Time (sword), Last Meadow Online, Orbs. Unavailable badges are omitted and other public-flag badges follow afterward. The Last Meadow badge is enabled from the screenshot; set `discord_last_meadow_badge` to `false` to hide it. Badges form compact rows of six below the name/status and support hover or keyboard-focus tooltips.

The profile's creation date is configured as **8 November 2025** (`2025-11-08`). Automatic Account Age advances on its UTC anniversary, reaching one year on **8 November 2026**. The screenshots already show the Seed badge, so `discord_account_age_minimum_years: 1` preserves that confirmed tier until the calendar calculation catches up. While the minimum determines the tier, the tooltip says **Level confirmed on Discord**, rather than claiming an anniversary has passed. Later anniversaries continue to upgrade the artwork. Without a valid configured date, the widget falls back to the Discord account ID's timestamp. This is an age-based display, not confirmation that Discord has enabled or displayed the badge for the account. Set the Lanyard KV key `discord_account_age_badge` to `false` to hide it.

Account Age, Nitro, and Server Booster are recalculated every minute while the page is visible, even if the presence provider fails, and immediately when the tab becomes visible again. Nitro and Booster use UTC calendar anniversaries (month-end dates clamp to the last day of the target month). Artwork upgrades at the corresponding milestone; observed game badges update on each successful presence poll (normally every 20 seconds). Their order stays fixed as icons change.

Nitro/Booster start dates in `DISCORD_BADGE_DEFAULTS` are fallbacks when live membership dates are unavailable. Update `discord_nitro_started_at` or `discord_booster_started_at` when a streak resets, or set `discord_nitro_badge` / `discord_booster_badge` to `false` if it ends. Lanyard does not reliably expose subscription cancellation. The displayed Legend Gifting badge is already its highest tier; Quest, Orbs, and Last Meadow keep their earned artwork.

For updates without redeploying, these optional [Lanyard KV keys](https://github.com/Phineas/lanyard#kv) override the local defaults. Lanyard's presence response does not include Discord's historical game or streaming progress.

| Key | Value |
| --- | --- |
| `discord_game_time_hours` | Total hours Discord has counted toward Game Time |
| `discord_games_played` | Whole number of different games Discord has counted |
| `discord_streaming_hours` | Total hours Discord has counted toward Streaming |
| `discord_account_age_minimum_years` | Confirmed Account Age tier (1–10), retained until the date calculation exceeds it |
| `discord_account_created_at` | Creation date override in `YYYY-MM-DD` format |
| `discord_game_time_baseline_hours` | Known hours to add to automatic estimates |
| `discord_games_played_minimum` | Known minimum distinct game count; observed counts can exceed it |
| `discord_last_meadow_badge` | `true` or `false` to show/hide the event badge |
| `discord_nitro_started_at` / `discord_booster_started_at` | Fallback streak start as an ISO timestamp |
| `discord_nitro_badge` / `discord_booster_badge` | `false` to hide a cancelled membership badge |
| `discord_account_age_badge` | `false` to hide the calculated Account Age badge |

For example, `.set discord_game_time_hours 75` sent to the Lanyard bot displays the Committed tier after the next widget refresh. Invalid or below-unlock totals leave that badge hidden. To hide an activity badge, set its manual total or KV key to `0`. Deleting a KV key restores the local default (and allows estimates when that default is `null`). The Dashboard's existing Badges toggle hides the complete badge row.

Badge meanings are documented in [Discord's profile badge guide](https://support.discord.com/hc/en-us/articles/44369363856663-Discord-Profile-Badges-What-Each-Badge-Means). Tier names, milestones, and Discord CDN artwork URLs are catalogued by [mezotv/discord-badges](https://github.com/mezotv/discord-badges#account-age-badges). Activity totals can lag behind recent activity in Discord.

## Live profile features

The compact **GitHub** module uses the same translucent card, small header/logo, stat tiles and tight rows as the other modules. It shows the account's contribution calendar, total stars earned across its owned public repositories, total public repository count, public commits made in the past year, and three recently updated original projects. Totals include public forks and archived repositories; the recent-project list excludes those. Projects include their primary language and GitHub-detected licence, or an explicit not-listed label. They are ordered by their latest push date, with a separate linked title for the latest default-branch commit. The repeated branch label is omitted from the card. Commit titles show the first line only; author emails and commit message bodies are omitted. Repository names, commit links, stats and the graph link directly to GitHub. The stars count is stars earned by these repositories, not repositories the account has starred.

The yearly commit count uses one cached GitHub commit-search query for `author:COOLmanYT`, a rolling year of author dates, and `is:public`, requesting just one result and reading `total_count`. [GitHub commit search indexes default branches](https://docs.github.com/en/search-github/searching-on-github/searching-commits); the count excludes private and unmerged branch-only commits and can lag indexing. Incomplete or failed search results stay unavailable rather than becoming zero. The count links to its exact GitHub search. Contribution totals are separate because the calendar also includes pull requests and other activity.

Dashboard and visitor Options independently control the GitHub header, star/repo totals, yearly commits, contribution graph, recent projects, commit titles, project language and licence. Global Dashboard controls take priority. Module and feature visibility controls are stored in this browser across refreshes. Clearing site storage resets them; different site origins (including separate preview URLs) have separate preferences. Disabling the module or all its main sections unmounts it and stops its browser polling.

The calendar reads [GitHub's own public contribution page](https://github.com/users/COOLmanYT/contributions), normalizes daily counts and levels, and renders its own responsive SVG. GitHub's calendar includes qualifying commits, pull requests and other contributions; it is not a commit-only count. No third-party graph service, raw provider HTML, GitHub token or new environment variable is needed. If GitHub changes that page's markup, the graph reports unavailable while repository data remains visible.

GitHub public profile status (emoji and message) is read from the public profile HTML with the same hourly cache and ETags. No token is required. Only publicly visible status is shown; no online presence is inferred. A missing status adds no empty row, and a status-fetch failure does not block repository data or shorten its cache. Both Dashboard and browser Options can hide this status. Module cards share their surface, border, padding and shadow while retaining provider accents.

Healthy snapshots are cached for one hour in the Vercel CDN and per server instance, with concurrent refreshes coalesced and ETags used on refresh. A normal refresh for this account uses one public repository-list request, one calendar page, one public profile page, one commit-count search and at most three latest-commit requests. Language and licence use existing repository metadata with no extra requests. Pagination is bounded at five repository pages (500 repos); if more pages exist, totals are marked unavailable rather than presenting partial sums. Partial snapshots report degraded status with a short CDN cache; upstream failures and rate limits use a shared retry cooldown. No request follows provider-supplied pagination URLs. Caches are per instance plus CDN, not a fleet-wide quota guarantee.

To publish a **live announcement**, DM the [Lanyard bot](https://github.com/Phineas/lanyard#kv):

```text
.set announcement New video tonight!
.set announcement_url https://www.youtube.com/@coolmangamer
```

The optional link must use HTTPS. The message is plain text, limited to 280 characters on the profile. To remove it, send `.del announcement`; remove the optional link with `.del announcement_url`. KV is public, so use it only for messages intended for everyone. Updates and deletion arrive on the same Lanyard WebSocket used by Discord and Spotify, with no additional polling, database or API key. While that connection is unavailable, the announcement is hidden. Clearing the message hides the whole announcement.

**Stream takeover** adds a large Twitch preview, stream title, category, viewers, locally updated uptime and a **Watch the stream** button at the top of the profile when Twitch reports a live broadcast. It shares the channel card's existing 30-second poll and cached response; it makes no additional Twitch requests and loads no Twitch player. Offline and unavailable responses remove the takeover. This follows the existing Twitch polling/cache delay rather than providing instant stream detection.

The Dashboard can disable GitHub, announcements or stream takeover globally. Takeover also respects the Twitch module and live-stream controls. Visitors can hide the new modules or takeover in this browser through **Options**. No schema migration, dependency or new environment variable is needed. CDN hits still count as edge requests, and process caches/cooldowns are per instance; these are cost reductions, not a fleet-wide quota guarantee.

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


### Settings and provider reliability

Successful dashboard saves invalidate the homepage (and other affected settings pages) for the next visit. Missing database configuration returns a failed save. Toggle defaults and loading are shared between the homepage and dashboard.

Spotify, Twitch, and Discord endpoints report `providerStatus`: `healthy`, `degraded` (partial data or fallback), or `unavailable`. Unavailable integrations return HTTP 503 with `Cache-Control: no-store`; genuine idle/offline activity remains HTTP 200. Twitch's optional stats can be degraded when OAuth scopes are missing. A missing Twitch schedule (404) is normal.

Activity polling pauses when the tab is hidden, aborts in-flight requests on hiding/unmounting, and retries with exponential backoff capped at five minutes. Requests time out after 15 seconds.

The in-memory rate limiter cleans expired entries on requests and caps storage at 10,000 identities per process, rejecting new identities at capacity. This is best-effort protection per server instance, not a global quota. Keep it for this profile's public read endpoints; use hosting edge/firewall rate limits if fleet-wide enforcement or stronger abuse protection is needed. No shared storage service is required or provisioned by this change.

Set `NEXT_PUBLIC_SITE_URL` to the deployment's public origin for social image URLs; it defaults to `https://profile.coolmanyt.com`.

Pull requests run tests, lint, TypeScript, and a production build via GitHub Actions without production credentials. Run the same checks locally with `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
