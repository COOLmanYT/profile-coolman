/** Lanyard KV is public. Render only plain text and an optional HTTPS link. */
/** @returns {{ message: string, url: string | null, label: string, linkText: string, placement: 'card' | 'bar' } | null} */
export function readAnnouncement(kv) {
  if (!kv || typeof kv.announcement !== 'string') return null
  const message = kv.announcement.trim().slice(0, 280)
  if (!message) return null
  let url = null
  try {
    const candidate = new URL(kv.announcement_url)
    if (candidate.protocol === 'https:' && !candidate.username && !candidate.password) url = candidate.href
  } catch { /* A link is optional. */ }
  const label = typeof kv.announcement_label === 'string' ? kv.announcement_label.trim().slice(0, 80) : 'A little update'
  const linkText = (typeof kv.announcement_link_text === 'string' ? kv.announcement_link_text.trim().slice(0, 80) : '') || 'Find out more'
  const placement = kv.announcement_placement === 'bar' ? 'bar' : 'card'
  return { message, url, label, linkText, placement }
}
