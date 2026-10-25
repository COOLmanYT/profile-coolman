import { siteConfig } from '@/lib/site-config.mjs'
import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const alt = `${siteConfig.profile.username} — ${siteConfig.profile.bio}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ height: '100%', width: '100%', display: 'flex', background: `linear-gradient(135deg, ${siteConfig.appearance.card.from}, ${siteConfig.appearance.card.to})`, color: 'white', padding: '70px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', border: '2px solid rgba(255,255,255,.25)', borderRadius: 42, padding: 52, background: 'rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 8, opacity: .72 }}>{siteConfig.profile.username.toUpperCase()} PROFILE</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', fontSize: 100, fontWeight: 800, letterSpacing: -4 }}>{siteConfig.profile.username}</div><div style={{ display: 'flex', marginTop: 16, fontSize: 38, opacity: .82 }}>{siteConfig.profile.bio}</div></div>
        <div style={{ display: 'flex', fontSize: 28, opacity: .72 }}>Twitch · Spotify · Discord</div>
      </div>
    </div>,
    size,
  )
}
