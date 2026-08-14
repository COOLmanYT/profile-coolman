import Link from 'next/link'

const REPOSITORY_URL = 'https://github.com/COOLmanYT/profile-coolman'
const LICENCE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`

export const metadata = { title: 'Licence | COOLman' }

export default function LicencePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#151515] px-5 py-10 text-white">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top,#e6000030,transparent_42%),radial-gradient(circle_at_bottom_right,#9146ff20,transparent_40%)]" />
      <article className="relative mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#211111]/90 shadow-2xl backdrop-blur">
        <div className="border-b border-white/10 bg-gradient-to-r from-[#e60000] to-[#8b0000] px-6 py-7 sm:px-8">
          <Link href="/" className="text-xs text-white/70 transition-colors hover:text-white">← Back to profile</Link>
          <div className="mt-7 flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl shadow-lg" aria-hidden>⚖️</span>
            <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-white/65">Open source</p><h1 className="mt-1 text-3xl font-bold tracking-tight">MIT Licence</h1></div>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <p className="text-base leading-7 text-white/80">This profile site is released under the MIT Licence. You are welcome to use, copy, modify and share the code, as long as the licence notice stays with it.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a href={LICENCE_URL} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:-translate-y-0.5 hover:border-red-300/40 hover:bg-white/10">
              <span className="text-lg" aria-hidden>📄</span><p className="mt-2 text-sm font-semibold">Read the full licence</p><p className="mt-1 text-xs leading-5 text-white/50">View the exact MIT Licence text on GitHub.</p><span className="mt-3 inline-block text-xs font-semibold text-red-200 group-hover:text-white">Open licence ↗</span>
            </a>
            <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:-translate-y-0.5 hover:border-red-300/40 hover:bg-white/10">
              <span className="text-lg" aria-hidden>⌘</span><p className="mt-2 text-sm font-semibold">View the repository</p><p className="mt-1 text-xs leading-5 text-white/50">Browse the source, changes and project details.</p><span className="mt-3 inline-block text-xs font-semibold text-red-200 group-hover:text-white">Open GitHub ↗</span>
            </a>
          </div>
          <p className="mt-6 text-xs leading-5 text-white/40">Copyright © 2026 COOLmanYT. The software is provided “as is”, without warranty.</p>
        </div>
      </article>
    </main>
  )
}
