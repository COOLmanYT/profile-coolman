import { COMMUNITY_LINKS } from '@/lib/community-profiles.mjs'

export default function BuyMeACoffeeWidget() {
  return (
    <section aria-label="Buy Me a Coffee" className="w-full rounded-2xl border border-amber-300/35 bg-[#30200c]/90 p-4 text-white shadow-lg shadow-amber-500/5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/15 text-amber-200"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm13 1h2a3 3 0 1 1 0 6h-2M3 22h16M8 2v3m5-3v3" /></svg></span>
        <div><h2 className="text-sm font-semibold text-amber-100">Buy Me a Coffee</h2><p className="mt-0.5 text-[11px] text-amber-100/65">A little support goes a long way</p></div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/75">Enjoy the videos or projects? You can support what I make. Thanks for being here!</p>
      <a href={COMMUNITY_LINKS.buymeacoffee} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-xl bg-amber-300 px-4 py-2.5 text-center text-sm font-bold text-amber-950 transition-colors hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100">Support COOLman <span aria-hidden>↗</span></a>
      <p className="mt-2 text-center text-[10px] text-amber-100/60">Opens Buy Me a Coffee · support is optional</p>
    </section>
  )
}
