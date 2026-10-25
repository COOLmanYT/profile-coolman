# Configure your profile

Edit `site.config.json`, then restart the development server or redeploy. It is public build-time data: anything in it can be downloaded by a visitor. Keep all credentials in `.env.local` or your hosting provider's secret environment settings.

Run `npm run config:check` for path-specific validation errors. Invalid configuration also fails the production build.

## Personalise the site

- `profile`: username, bio, location, avatar and birthday (month/day only). Use a `/public-file.png` path or an HTTPS URL for the avatar. The same identity appears in page metadata, legal page branding, widgets' fallback labels and share cards.
- `site`: public origin, repository for the licence/changelog, legal contact address and language. `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_CONTACT_EMAIL` remain optional deployment overrides.
- `socials`: ordered links with a label, URL, icon and `enabled` flag. Supported icons: `globe`, `youtube`, `x`, `twitch`, `spotify`, `buymeacoffee`, `github`, `steam`, `discord`, `roblox`. Unknown icon names use the globe.
- `providers`: your public account identifiers. Roblox needs the numeric user ID, Steam needs the 17-digit SteamID64, YouTube needs the channel ID starting with `UC`. Set Discord membership dates and badge totals to your own values; these are manual fallbacks, not provider-verified achievements. Use `null` for estimated game totals, `0` to hide an activity badge, and `false` for unearned membership/event badges.
- `providers.status`: your public component feed, status page URL, profile component name and summary label. Disable the status module if you do not operate a compatible component feed.

The included configuration preserves this site's branding. Fork owners should replace every public identity and review their own legal wording, artwork and licence obligations before publishing. Nothing copies credentials from the original deployment.

## Module availability and defaults

```json
"spotify": {
  "label": "Spotify",
  "description": "Music and listening history",
  "enabled": true,
  "default": true,
  "features": {
    "history": { "label": "Listening history", "enabled": false, "default": false }
  }
}
```

Keep the complete module entry and set `enabled: false` to exclude it. That removes the module and its controls from the dashboard and visitor Options, prevents its public endpoint from calling the provider, and overrides old database/browser preferences. Feature-level `enabled: false` removes that feature's control and prevents it from rendering. Disabled controls cannot be saved through the dashboard endpoint. The Discord endpoint is shared by Discord, Spotify and announcements, so it stays available while any of those modules is included.

`default` is the initial global value when there is no database override. Unlike availability, it can be changed in the dashboard. Precedence is: JSON availability, saved global toggle (or JSON default), then visitor hiding. JSON changes require a restart/redeploy; dashboard values persist in your own Supabase project. The YouTube `embed_default` feature's availability also gates the visitor's player override.

Integration cards follow module order in the JSON. Profile identity, announcements, live Twitch takeover and page-level controls retain their designated layout positions. All existing integration feature IDs are listed in the JSON. The profile details, social links, status, views, likes, sharing, seasonal effects, analytics and developer easter egg also have module switches. Disabling a module prevents mounting/polling; it is not a guarantee that every related source file is removed from JavaScript bundles.

## Add a module

1. Add a camelCase ID under `modules`, with `label`, `description`, `enabled`, `default`, and `features` (use `{}` when there are none). Feature IDs use lowercase letters, digits and underscores. Controls are named `<module>_<feature>`.
2. Add your component to the `modules` registry in `components/ProfileCard.tsx`. Use the effective `toggles` for both the parent and each feature, plus the existing visitor visibility helpers. Render the component only when enabled so its effects do not run while hidden.
3. If it needs an endpoint, check `isModuleAvailable(id)` before calling any provider. Return a no-store 404 when unavailable. Keep keys server-side and use the shared timeout, polling, rate-limit and cache helpers.
4. Add a behaviour test for the component or endpoint. The dashboard, toggle allowlist, defaults, visitor feature list and module ordering are generated from the JSON; no separate UI lists need updating.

## Appearance and backgrounds

`appearance.defaultMode` accepts `dark`, `light` or `system`. `allowModeSwitch: false` removes the selector and ignores any older browser colour preference. When enabled, visitors choose in Options and their preference survives refresh. Reset to default clears it.

`appearance.card.from` and `to` set the dark card gradient. Light mode uses a neutral light card for readable text; the owner-selected background remains visible.

Background settings:

| Field | Values |
| --- | --- |
| `type` | `preset`, `color`, `image`, `gif`, `video` |
| `preset` | `waves`, `gradient`, `aurora` |
| `animation` | `none`, `drift`, `pulse` |
| `colors` | 1–8 six-digit hex colours; the first is the fallback/solid colour |
| `speed` | 0.1–3 |
| `src` | Local `/path` or HTTPS image, GIF, MP4 or WebM URL |
| `poster` | Optional static image for video/GIF fallback and reduced motion |
| `fit` / `position` | `cover` or `contain`; CSS object position such as `center` or `50% 30%` |
| `overlay` | Black overlay opacity, 0–1 |

Example video background (keep the other background fields):

```json
"type": "video",
"src": "/backgrounds/ambient.webm",
"poster": "/backgrounds/ambient-poster.jpg",
"overlay": 0.35
```

Put those files in `public/backgrounds/`. External media origins are added to the content security policy from the validated config, without allowing every remote host. If a media URL redirects to another host, use its final URL. Unsupported codecs, blocked autoplay or failed downloads retain the poster/fallback colour. Videos are muted, looped and inline; GIFs use native images. Reduced motion replaces GIF/video motion with a static poster or fallback colour; hidden pages stop animated canvas work and video playback. Still images must actually be static to honour that preference. Media animations use their own GIF/video timeline; `animation` and `speed` control presets.

## Bring your own credentials

Copy `.env.example` to `.env.local`; only fill the integrations you enable. Set the same values in the fork's hosting environment. Never commit `.env.local`, paste keys into the JSON or use a `NEXT_PUBLIC_` name for secrets.

| Integration | Server environment variables |
| --- | --- |
| Discord dashboard | `DISCORD_USER_ID` (owner's ID), `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |
| Discord/Spotify live presence | `DISCORD_USER_ID`; join/configure Lanyard for that account |
| Spotify API fallback/history | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` from your app/account |
| Twitch | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI`; connect your own account through the dashboard, or supply `TWITCH_REFRESH_TOKEN` |
| YouTube | Optional `YOUTUBE_API_KEY`; public pages are the fallback |
| GitHub | Optional `GITHUB_TOKEN` for the existing authenticated public-data loader |
| Counters/global settings/Twitch token persistence | Your Supabase URL and `SUPABASE_SERVICE_ROLE_KEY`; apply the existing migrations in your own project |

Roblox, Steam and Buy Me a Coffee use public profiles without keys. Missing/private data is unavailable rather than a fabricated zero. Disabling unavailable integrations gives a working static profile without their credentials. OAuth callbacks must belong to your fork's origin, and refresh tokens must belong to your intended account. `TWITCH_BROADCASTER_LOGIN` can override the JSON login on the server; keep both aligned so client fallback links match.

The public Supabase URL and legacy anon/publishable key are not privileged secrets; the service-role key is. This app's writes use the server service key. Keep existing database access policies and migrations in place.
