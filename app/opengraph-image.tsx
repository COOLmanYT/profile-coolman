import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'COOLman — just a cool dude making content'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ height: '100%', width: '100%', display: 'flex', background: 'linear-gradient(135deg, #ff0000, #710000)', color: 'white', padding: '70px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', border: '2px solid rgba(255,255,255,.25)', borderRadius: 42, padding: 52, background: 'rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 8, opacity: .72 }}>COOLMAN PROFILE</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', fontSize: 100, fontWeight: 800, letterSpacing: -4 }}>COOLman</div><div style={{ display: 'flex', marginTop: 16, fontSize: 38, opacity: .82 }}>just a cool dude making content</div></div>
        <div style={{ display: 'flex', fontSize: 28, opacity: .72 }}>Twitch · Spotify · Discord</div>
      </div>
    </div>,
    size,
  )
}
