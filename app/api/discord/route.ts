import { NextResponse } from 'next/server'

const DISCORD_USER_ID = process.env.DISCORD_USER_ID
const noStore = { headers: { 'Cache-Control': 'no-store' } }

export async function GET() {
  if (!DISCORD_USER_ID) {
    return NextResponse.json({ discord_status: 'offline', activities: [] }, noStore)
  }
  try {
    const res = await fetch(
      `https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`,
      { cache: 'no-store' }
    )
    if (!res.ok) {
      return NextResponse.json({ discord_status: 'offline', activities: [] }, noStore)
    }
    const json = await res.json()
    if (!json.success) {
      return NextResponse.json({ discord_status: 'offline', activities: [] }, noStore)
    }
    const data = json.data
    return NextResponse.json({
      discord_status: data.discord_status,
      activities: data.activities ?? [],
      discord_user: data.discord_user,
      active_on_discord_mobile: data.active_on_discord_mobile ?? false,
      active_on_discord_web: data.active_on_discord_web ?? false,
      active_on_discord_desktop: data.active_on_discord_desktop ?? false,
    }, noStore)
  } catch {
    return NextResponse.json({ discord_status: 'offline', activities: [] }, noStore)
  }
}
