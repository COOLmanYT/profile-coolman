'use client'

import { useEffect, useState } from 'react'
import { fetchWidgetJson, startPolling } from '@/lib/widget-polling.mjs'

interface GithubActivity {
  totalStars: number | null
  publicRepos: number | null
  calendar: { days: Array<{ date: string; count: number; level: number }>; total: number; url: string } | null
  projects: Array<{ name: string; url: string; updatedAt: string; defaultBranch: string; stars: number | null; commit: { title: string; sha: string; url: string } | null }>
}

const PROFILE_URL = 'https://github.com/COOLmanYT'
const COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
const dateLabel = (date: string) => new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function ContributionGraph({ calendar }: { calendar: NonNullable<GithubActivity['calendar']> }) {
  const width = Math.ceil(calendar.days.length / 7) * 11
  return (
    <a href={calendar.url} target="_blank" rel="noopener noreferrer" aria-label="View full GitHub contribution graph" className="mt-4 block rounded-xl border border-white/10 bg-black/15 p-2.5 transition-colors hover:border-emerald-400/35">
      <p className="mb-2 flex items-center justify-between text-[10px] text-white/60"><span>Contributions · past year</span><span aria-hidden>↗</span></p>
      <svg viewBox={`0 0 ${width} 92`} role="img" aria-label={`${calendar.total.toLocaleString()} GitHub contributions shown over the past year`} className="block w-full">
        {calendar.days.map((day, index) => {
          const date = new Date(`${day.date}T00:00:00Z`)
          const x = Math.floor(index / 7) * 11
          return <g key={day.date}>
            {date.getUTCDate() === 1 && <text x={x} y="8" fill="#8b949e" fontSize="8">{date.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' })}</text>}
            <rect x={x} y={14 + date.getUTCDay() * 11} width="8" height="8" rx="1.5" fill={COLORS[day.level]}><title>{day.count} {day.count === 1 ? 'contribution' : 'contributions'} on {dateLabel(day.date)}</title></rect>
          </g>
        })}
      </svg>
      <div className="mt-1 flex items-center justify-end gap-1 text-[8px] text-white/40"><span className="mr-1">Less</span>{COLORS.map(color => <span key={color} className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} aria-hidden />)}<span className="ml-1">More</span></div>
      <p className="mt-2 text-[9px] text-white/35">Includes commits, pull requests and other contributions.</p>
    </a>
  )
}

export default function GithubWidget() {
  const [activity, setActivity] = useState<GithubActivity | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => startPolling({
    intervalMs: 60 * 60 * 1000,
    poll: async (signal: AbortSignal) => {
      const data = await fetchWidgetJson('/api/github', signal) as GithubActivity
      if (signal.aborted) return
      setActivity(data)
      setUnavailable(false)
    },
    onError: () => setUnavailable(true),
  }), [])

  return (
    <section aria-label="GitHub activity" className="w-full rounded-2xl border border-white/15 bg-[#0d1117]/90 p-4">
      <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm font-semibold text-white"><span>GitHub <span className="ml-1 text-xs font-normal text-white/50">@COOLmanYT</span></span><span aria-hidden>↗</span></a>
      <p className="mt-1 text-[10px] text-white/45">What I’m building · refreshes hourly</p>
      {unavailable ? <p role="status" className="mt-3 text-xs text-white/55">GitHub activity temporarily unavailable.</p>
        : !activity ? <div className="mt-3 h-48 animate-pulse rounded-lg bg-white/5" aria-label="Loading GitHub activity" />
        : <>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <a href={`${PROFILE_URL}?tab=repositories&sort=stargazers`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/5 bg-white/5 px-2 py-2.5 hover:bg-white/10"><span className="block text-lg font-bold text-white">{activity.totalStars?.toLocaleString() ?? '—'}</span><span className="text-[10px] text-white/50">★ Total stars</span></a>
            <a href={`${PROFILE_URL}?tab=repositories&type=public`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/5 bg-white/5 px-2 py-2.5 hover:bg-white/10"><span className="block text-lg font-bold text-white">{activity.publicRepos?.toLocaleString() ?? '—'}</span><span className="text-[10px] text-white/50">Public repos</span></a>
          </div>
          {activity.calendar ? <ContributionGraph calendar={activity.calendar} /> : <p className="mt-4 text-[11px] text-white/45">Contribution graph temporarily unavailable. <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="underline">View on GitHub ↗</a></p>}
          <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-white/45">Recently updated projects</h3>
          {activity.projects.length === 0 ? <p className="mt-2 text-xs text-white/55">No recently updated original projects.</p> : <ul className="mt-1 divide-y divide-white/5">{activity.projects.map(project => <li key={project.name} className="py-3 last:pb-0">
            <a href={project.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-2 text-xs font-semibold text-emerald-300 hover:underline"><span className="break-all">{project.name}</span><span className="shrink-0 text-[10px] text-white/45">{project.stars !== null && `★ ${project.stars}`} ↗</span></a>
            <p className="mt-1 text-[10px] text-white/40">Updated <time dateTime={project.updatedAt} title={project.updatedAt}>{dateLabel(project.updatedAt)}</time></p>
            {project.commit ? <a href={project.commit.url} target="_blank" rel="noopener noreferrer" className="mt-2 block rounded-lg bg-white/[0.03] p-2 text-[11px] text-white/75 hover:bg-white/[0.07]"><span className="mb-0.5 block truncate text-[9px] text-white/35">Latest on {project.defaultBranch} · {project.commit.sha.slice(0, 7)}</span><span className="break-words">{project.commit.title} <span aria-hidden>↗</span></span></a> : <p className="mt-2 text-[10px] text-white/40">Latest commit unavailable.</p>}
          </li>)}</ul>}
        </>}
    </section>
  )
}
