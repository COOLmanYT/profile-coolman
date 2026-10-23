/** Lanyard exposes public Discord presence, never Spotify OAuth credentials. */
export function lanyardTrack(presence, now = Date.now()) {
  const song = presence?.listening_to_spotify && presence.spotify
  const start = song?.timestamps?.start
  const end = song?.timestamps?.end
  if (!song || !/^[a-zA-Z0-9]{22}$/.test(song.track_id ?? '')
    || typeof song.song !== 'string' || !Number.isFinite(start) || !Number.isFinite(end)
    || end <= start || now >= end || start > now + 5000) return null
  const artists = typeof song.artist === 'string' ? song.artist.split(';').map(value => value.trim()).filter(Boolean) : []
  return {
    isPlaying: true,
    title: song.song,
    artist: artists.join(', '),
    artists,
    albumArt: song.album_art_url,
    songUrl: `https://open.spotify.com/track/${song.track_id}`,
    embedUrl: `https://open.spotify.com/embed/track/${song.track_id}`,
    durationMs: end - start,
    progressMs: Math.max(0, now - start),
    observedAt: now,
    expiresAt: end,
  }
}
