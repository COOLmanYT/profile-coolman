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

Profile sections, announcements, integrations and social links follow `layout.moduleOrder`. Page-level status, views, likes and sharing stay outside the profile card; the live Twitch takeover stays at the top. Use the dashboard’s **Arrange modules and features** controls to change the order with a live profile preview. The settings cards follow the same saved order. All existing integration feature IDs are listed in the JSON. The profile details, social links, status, views, likes, sharing, seasonal effects, analytics and developer easter egg also have module switches. Disabling a module prevents mounting/polling; it is not a guarantee that every related source file is removed from JavaScript bundles.

## Add a module

1. Add a camelCase ID under `modules`, with `label`, `description`, `enabled`, `default`, and `features` (use `{}` when there are none). Feature IDs use lowercase letters, digits and underscores. Controls are named `<module>_<feature>`.
2. Add your component to the `modules` registry in `components/ProfileCard.tsx`. Use the effective `toggles` for both the parent and each feature, plus the existing visitor visibility helpers. Render the component only when enabled so its effects do not run while hidden.
3. If it needs an endpoint, check `isModuleAvailable(id)` before calling any provider. Return a no-store 404 when unavailable. Keep keys server-side and use the shared timeout, polling, rate-limit and cache helpers.
4. Wrap the component in `FeatureLayout` from `components/FeatureLayout.tsx`, passing its module ID. Mark reorderable sibling sections with `<FeatureSlot data-feature="weather_temperature">…</FeatureSlot>` (or `data-feature` on the actual element). Keep features within their semantic parent. They can then be ordered using `layout.featureOrder.weather`. New module controls and ordering lists are generated from JSON; optionally add logical feature groups to `FEATURE_ORDER_GROUPS` in `lib/layout-order.mjs`.
5. Add a behaviour test for the component or endpoint. The dashboard, toggle allowlist, defaults and visitor feature list are generated from JSON.

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

## Dashboard features and ordering

`dashboard.features` controls whether the ordering, announcement editor, seasonal editor and access manager exist. Setting a feature to `false` removes its UI and rejects writes to its endpoint. These flags do not replace `modules.<id>.enabled`, which is the availability ceiling for visitor-facing modules.

`layout.moduleOrder` is an array of module IDs. `layout.featureOrder` maps module IDs to arrays of full feature IDs, such as `github_graph`. Unknown or duplicate IDs fail configuration validation. Omitted available IDs are appended, so adding a feature does not hide it. Code-disabled items are removed even when a database order includes them. Saved dashboard ordering overrides JSON ordering; set `dashboard.features.ordering: false` to use JSON only.

Features move within their logical parent: cards’ sections, statistics within their row, and name/username within a header. Behaviour settings (upload format, embed defaults, device filters and live takeover) stay visibility/settings switches. Avatar overlays remain attached to their avatar. The profile’s username moves with its bio/details group. The dashboard shows separate ordering groups for these relationships.

## Announcements

Enable `modules.announcement.enabled` and `dashboard.features.announcements` to publish a plain-text announcement (up to 280 characters) with an optional HTTPS link from the dashboard. **Publish announcement** persists the message; **Clear announcement** saves an empty override. Visitors see changes on their next page load. No extra public polling is added.

`announcement.source` accepts:

- `auto`: use a saved dashboard message, then the JSON `message`/`url`, then the existing Lanyard `announcement` and `announcement_url` KV fallback. A saved empty announcement deliberately suppresses the fallback.
- `dashboard`: use dashboard/JSON content only, with no Lanyard fallback.
- `lanyard`: use live Lanyard KV only and hide the dashboard editor.

Setting `dashboard.features.announcements: false` ignores saved dashboard announcements and uses the selected JSON/Lanyard source. Content is rendered as escaped text. Announcement links cannot contain credentials or use non-HTTPS schemes.

## Seasonal themes

`seasonal.availableThemes` determines which events exist in this fork: Christmas, Halloween, Easter, New Year and Birthday. Set an event to `false` and remove it from `seasonal.defaults.enabledThemes` (and any JSON schedule) to remove it from all seasonal choices. Old dashboard and visitor preferences cannot restore it.

`seasonal.defaults` contains `enabledThemes`, `automaticEnabled`, `scheduledTheme`, `scheduledStartsAt`, `scheduledEndsAt` and `scheduledLocation`. Automatic dates use the visitor’s time zone and the configured profile birthday. Scheduled dates use ISO timestamps with an offset or `Z`; a start before the end is required. Locations are `anywhere`, `australia` or `outside-australia`.

The dashboard can enable individual available events, turn automatic dates on/off, and schedule an event. An event disabled there cannot run through a saved personal preference either. JSON availability is always the ceiling; dashboard values override JSON defaults. Disabling the seasonal editor hides editing, while JSON defaults and existing saved settings still control the site. Disable the entire `seasons` module to remove seasonal effects and visitor controls.

## Dashboard access and OAuth for forks

This repository keeps Discord enabled, GitHub/Google disabled, and access management disabled. The same `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_USER_ID` and `NEXTAUTH_SECRET` continue to work; existing Discord sessions without the new provider claim remain accepted. Do not rotate those secrets or disable Discord when updating this deployment.

Forks can opt into GitHub and/or Google in `dashboard.auth.providers`. Add the matching server-only `AUTH_GITHUB_CLIENT_ID` / `AUTH_GITHUB_CLIENT_SECRET` or `AUTH_GOOGLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_SECRET`; buttons only appear for configured providers. Register callbacks at your own origin: `/api/auth/callback/discord`, `/api/auth/callback/github`, `/api/auth/callback/google`. Keep `NEXTAUTH_URL` set to your origin. These apps and credentials are separate from the public GitHub widget token.

Permanent owners come from `DISCORD_USER_ID` for Discord, plus optional `DASHBOARD_OWNER_ACCOUNTS` entries such as `github:123456,google:123456789`. Use stable provider account IDs, not usernames or email addresses. Add and verify your intended permanent owner before switching providers. A disabled provider grants no access, including to owners. If needed, recover access by restoring a known owner/provider in the deployment’s server settings.

Set `dashboard.features.accessManagement: true` to let permanent owners add/remove editor accounts using provider and account ID. Editors can manage site settings; only permanent owners can change access or connect Twitch. Owners cannot be removed in the UI. Membership is checked against the private database on every dashboard request and mutation, so removals apply to existing sessions immediately. Database failures deny editors while the permanent owner retains access. OAuth accounts are not linked by email.

Dashboard order, announcements and access reuse the existing private Supabase `site_settings` table (`profile-layout`, `profile-announcement`, `dashboard-access`); seasonal settings keep using `seasonal`. No additional migration is required when the existing migrations are applied. Provider secrets and account allowlists are never included in public JSON or public API responses.

The public [background guide](/backgrounds) includes copyable colour, preset, animation, image, GIF and video examples, and is linked from the dashboard.
