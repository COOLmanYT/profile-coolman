import Link from 'next/link'

const REPOSITORY_URL = 'https://github.com/COOLmanYT/profile-coolman'
type Commit = { sha: string; html_url: string; commit: { message: string; author: { date: string } } }

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
        {commits.length > 0 ? <ol className="mt-7 space-y-3">{commits.map((commit) => <li key={commit.sha} className="relative border-l border-red-400/35 pl-5"><span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" /><a href={commit.html_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg py-0.5 transition-colors hover:text-red-200"><p className="text-sm font-medium">{commit.commit.message.split('\n')[0]}</p><p className="mt-1 text-xs text-white/45">{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(commit.commit.author.date))} · {commit.sha.slice(0, 7)}</p></a></li>)}</ol> : <p className="mt-7 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">The changelog is temporarily unavailable. You can still view it on GitHub.</p>}
      </article>
    </main>
  )
}
