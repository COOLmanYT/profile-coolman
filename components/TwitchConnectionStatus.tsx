import type { TwitchHealth } from '@/lib/twitch'

const STYLES: Record<TwitchHealth['state'], string> = {
  connected: 'border-green-400/25 bg-green-400/10 text-green-200',
  needs_connection: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
  needs_configuration: 'border-red-400/25 bg-red-400/10 text-red-100',
}

export default function TwitchConnectionStatus({ health }: { health: TwitchHealth }) {
  const heading = health.state === 'connected' ? 'Twitch connected' : health.state === 'needs_connection' ? 'Twitch needs connection' : 'Twitch setup incomplete'
  const expiry = health.expiresAt && new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(health.expiresAt))

  return (
    <section className={`mt-6 rounded-xl border p-3 ${STYLES[health.state]}`} aria-live="polite">
      <h2 className="text-sm font-semibold">{heading}</h2>
      <p className="mt-1 text-xs opacity-80">{health.message}</p>
      {expiry && <p className="mt-1 text-xs opacity-70">Current token expires {expiry}</p>}
    </section>
  )
}
