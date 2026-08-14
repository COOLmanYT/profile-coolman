import Link from 'next/link'

const REPOSITORY_URL = 'https://github.com/COOLmanYT/profile-coolman'
type Commit = { sha: string; html_url: string; commit: { message: string; author: { date: string } } }

function releaseStyle(message: string) {
  const lower = message.toLowerCase()
  if (lower.startsWith('fix') || lower.includes('security')) return { label: 'Fixed', tone: 'border-amber-300/25 bg-amber-300/10 text-amber-100' }
  if (lower.startsWith('add')) return { label: 'New', tone: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' }
  if (lower.startsWith('update') || lower.startsWith('improve')) return { label: 'Improved', tone: 'border-sky-300/25 bg-sky-300/10 text-sky-100' }
  return { label: 'Updated', tone: 'border-red-300/25 bg-red-300/10 text-red-100' }
}

async function getCommits(): Promise<Commit[]> {
  try {
    const response = await fetch(`${REPOSITORY_URL.replace('https://github.com', 'https://api.github.com/repos')}/commits?per_page=12`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'COOLmanYT-profile-site' }, next: { revalidate: 3600 },
    })
    if (!response.ok) return []
    return await response.json() as Commit[]
  } catch {
    return []
  }
}

export const metadata = { title: 'Changelog | COOLman' }

export default async function ChangelogPage() {
  const commits = await getCommits()
  return (
    <main className="min-h-screen bg-[#151515] px-5 py-10 text-white">
      <article className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7">
        <Link href="/" className="text-xs text-white/45 hover:text-white">← Back to profile</Link>
        <div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">From GitHub</p><h1 className="mt-1 text-3xl font-bold">Changelog</h1></div><a href={`${REPOSITORY_URL}/commits/main`} target="_blank" rel="noopener noreferrer" className="text-xs text-white/50 hover:text-white">All commits ↗</a></div>
        <p className="mt-3 text-sm text-white/55">Recent changes are fetched from the public repository.</p>
        {commits.length > 0 ? <ol className="mt-7 grid gap-3 sm:grid-cols-2">{commits.map((commit) => { const title = commit.commit.message.split('\n')[0]; const style = releaseStyle(title); return <li key={commit.sha}><a href={commit.html_url} target="_blank" rel="noopener noreferrer" className="block h-full rounded-2xl border border-white/10 bg-black/20 p-4 transition-all hover:-translate-y-0.5 hover:border-red-300/35 hover:bg-black/30"><div className="flex items-start justify-between gap-3"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.tone}`}>{style.label}</span><span className="text-[10px] text-white/35">{commit.sha.slice(0, 7)}</span></div><p className="mt-4 text-sm font-semibold leading-5 text-white/90">{title}</p><p className="mt-3 text-xs text-white/45">{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(commit.commit.author.date))} · View on GitHub ↗</p></a></li> })}</ol> : <p className="mt-7 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">The changelog is temporarily unavailable. You can still view it on GitHub.</p>}
      </article>
    </main>
  )
}
