/** Lanyard KV is public. Render only plain text and an optional HTTPS link. */
export function readAnnouncement(kv) {
  if (!kv || typeof kv.announcement !== 'string') return null
  const message = kv.announcement.trim().slice(0, 280)
  if (!message) return null
  let url = null
  try {
    const candidate = new URL(kv.announcement_url)
    if (candidate.protocol === 'https:' && !candidate.username && !candidate.password) url = candidate.href
  } catch { /* A link is optional. */ }
  return { message, url }
}
