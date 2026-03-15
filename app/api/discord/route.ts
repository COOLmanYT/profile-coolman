import { NextResponse } from 'next/server'

const DISCORD_USER_ID = process.env.DISCORD_USER_ID

export async function GET() {
  if (!DISCORD_USER_ID) {
    return NextResponse.json({ discord_status: 'offline', activities: [] })
  }
  try {
    const res = await fetch(
      `https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`,
      { cache: 'no-store' }
    )
    if (!res.ok) {
      return NextResponse.json({ discord_status: 'offline', activities: [] })
    }
    const json = await res.json()
    if (!json.success) {
      return NextResponse.json({ discord_status: 'offline', activities: [] })
    }
    const data = json.data
    return NextResponse.json({
      discord_status: data.discord_status,
      activities: data.activities ?? [],
      discord_user: data.discord_user,
    })
  } catch {
    return NextResponse.json({ discord_status: 'offline', activities: [] })
  }
}
