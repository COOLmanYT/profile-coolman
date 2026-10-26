'use client'

import FeatureLayout, { FeatureSlot } from './FeatureLayout'

import { siteConfig, providerLinks, isControlAvailable } from '@/lib/site-config.mjs'

import { useEffect, useState } from 'react'
import { fetchWidgetJson, startPolling } from '@/lib/widget-polling.mjs'

interface GithubActivity {
  status: { message: string; emoji: string } | null
  statusUnavailable?: boolean
  totalStars: number | null
  publicRepos: number | null
  commitsPastYear: number | null
  commitsUrl: string
  calendar: { days: Array<{ date: string; count: number; level: number }>; total: number; url: string } | null
  projects: Array<{ name: string; url: string; updatedAt: string; defaultBranch: string; stars: number | null; language: string | null; licence: { name: string; label: string } | null; commit: { title: string; sha: string; url: string } | null }>
}

interface GithubWidgetProps {
  showStatus?: boolean
  showProfile?: boolean
  showStats?: boolean
  showCommitCount?: boolean
  showGraph?: boolean
  showProjects?: boolean
  showCommitTitles?: boolean
  showLanguage?: boolean
  showLicence?: boolean
}

const PROFILE_URL = providerLinks.github
const COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
const dateLabel = (date: string) => new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function ContributionGraph({ calendar }: { calendar: NonNullable<GithubActivity['calendar']> }) {
  const width = Math.ceil(calendar.days.length / 7) * 11
  return (
    <a href={calendar.url} target="_blank" rel="noopener noreferrer" aria-label="View full GitHub contribution graph" title="GitHub contributions include commits, pull requests and other activity." className="mt-2.5 block border-t border-white/10 pt-2">
      <p className="mb-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-white/50"><span>Contributions · past year</span><span aria-hidden>↗</span></p>
      <svg viewBox={`0 0 ${width} 92`} role="img" aria-label={`${calendar.total.toLocaleString()} GitHub contributions shown over the past year`} className="block w-full">
        {calendar.days.map((day, index) => {
          const date = new Date(`${day.date}T00:00:00Z`)
          const x = Math.floor(index / 7) * 11
          return <g key={day.date}>
            {date.getUTCDate() === 1 && <text x={x} y="8" fill="#8b949e" fontSize="8">{date.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' })}</text>}
            <rect x={x} y={14 + date.getUTCDay() * 11} width="8" height="8" rx="1.5" fill={COLORS[day.level]}><title>{`${day.count} ${day.count === 1 ? 'contribution' : 'contributions'} on ${dateLabel(day.date)}`}</title></rect>
          </g>
        })}
      </svg>
      <div className="flex items-center justify-end gap-1 text-[8px] text-white/40"><span className="mr-1">Less</span>{COLORS.map(color => <span key={color} className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden />)}<span className="ml-1">More</span></div>
    </a>
  )
}

export default function GithubWidget({ showStatus = true, showProfile = true, showStats = true, showCommitCount = true, showGraph = true, showProjects = true, showCommitTitles = true, showLanguage = true, showLicence = true }: GithubWidgetProps) {
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

  const stats = activity ? [
    ...(showStats ? [
      { value: activity.totalStars, label: 'Stars', href: `${PROFILE_URL}?tab=repositories&sort=stargazers`, description: 'Total stars earned by public repositories' },
      { value: activity.publicRepos, label: 'Public repos', href: `${PROFILE_URL}?tab=repositories&type=public`, description: 'Total public repositories' },
    ] : []),
    ...(showCommitCount ? [{ value: activity.commitsPastYear, label: 'Commits · past year', href: activity.commitsUrl, description: 'Public commits made in past year, indexed on default branches' }] : []),
  ] : []

  return (
    <FeatureLayout module="github"><section aria-label="GitHub activity" className="profile-module">
      <FeatureSlot data-feature="github_profile">{showProfile && <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-white">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
        </span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-tight">GitHub</span><span className="block text-[11px] text-white/55">@{siteConfig.providers.github.username}</span></span><span className="text-xs text-white/50" aria-hidden>↗</span>
      </a>}</FeatureSlot>
      {unavailable ? <p role="status" className="mt-2 text-xs text-white/55">GitHub temporarily unavailable.</p>
        : !activity ? <div className="mt-2 h-20 animate-pulse rounded-lg bg-white/5" aria-label="Loading GitHub activity" />
        : <>
          <FeatureSlot data-feature="github_status">{showStatus && activity.status && <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub public status" className="mt-2 flex items-start gap-2 rounded-lg bg-white/5 px-2.5 py-2 text-xs text-white/75"><span aria-hidden>{activity.status.emoji}</span><span className="min-w-0 break-words">{activity.status.message || 'GitHub status'}</span></a>}</FeatureSlot>
          <FeatureSlot data-feature="github_status">{showStatus && activity.statusUnavailable && <p className="mt-2 text-[10px] text-white/45">GitHub status unavailable.</p>}</FeatureSlot>
          {stats.length > 0 && <div data-feature={isControlAvailable('github_stats') ? 'github_stats' : 'github_commits'} className={`mt-2.5 grid gap-2 text-center ${stats.length === 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>{stats.map(stat => <a key={stat.label} data-feature={stat.label === 'Commits · past year' ? 'github_commits' : 'github_stats'} href={stat.href} target="_blank" rel="noopener noreferrer" aria-label={`${stat.value?.toLocaleString() ?? 'Unavailable'} ${stat.description}`} title={stat.description} className="rounded-lg bg-white/5 px-1.5 py-1.5 hover:bg-white/10"><span className="block text-sm font-semibold text-white">{stat.value?.toLocaleString() ?? '—'}</span><span className="text-[9px] text-white/55">{stat.label}</span></a>)}</div>}
          <FeatureSlot data-feature="github_graph">{showGraph && (activity.calendar ? <ContributionGraph calendar={activity.calendar} /> : <p className="mt-2 text-[10px] text-white/45">Graph unavailable. <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="underline">View on GitHub ↗</a></p>)}</FeatureSlot>
          <FeatureSlot data-feature="github_projects">{showProjects && <div className="mt-2.5 border-t border-white/10 pt-2">
            <h3 className="text-[9px] font-semibold uppercase tracking-wider text-white/50">Recently updated</h3>
            {activity.projects.length === 0 ? <p className="mt-2 text-xs text-white/55">No recently updated original projects.</p> : <ul className="mt-0.5 divide-y divide-white/5">{activity.projects.map(project => <li key={project.name} className="py-2 last:pb-0">
              <div className="flex items-baseline justify-between gap-2"><a href={project.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-xs font-semibold text-white/90 hover:underline" title={project.name}>{project.name} ↗</a><time dateTime={project.updatedAt} title={`Updated ${dateLabel(project.updatedAt)}`} className="shrink-0 text-[9px] text-white/40">{dateLabel(project.updatedAt)}</time></div>
              {(showLanguage || showLicence) && <p className="mt-0.5 flex flex-wrap gap-x-2 text-[9px] text-white/45"><FeatureSlot data-feature="github_language">{showLanguage && <span>{project.language ?? 'No language listed'}</span>}</FeatureSlot><FeatureSlot data-feature="github_licence">{showLicence && <span title={project.licence?.name ?? 'GitHub has not identified a licence for this repository'}>{project.licence?.label ?? 'No licence listed'}</span>}</FeatureSlot></p>}
              <FeatureSlot data-feature="github_commit_titles">{showCommitTitles && (project.commit ? <a href={project.commit.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-[10px] text-white/60 hover:text-white/90 hover:underline" title={`${project.commit.title} (${project.commit.sha.slice(0, 7)})`}>{project.commit.title}</a> : <p className="mt-0.5 text-[10px] text-white/40">Latest commit unavailable.</p>)}</FeatureSlot>
            </li>)}</ul>}
          </div>}</FeatureSlot>
        </>}
    </section></FeatureLayout>
  )
}
