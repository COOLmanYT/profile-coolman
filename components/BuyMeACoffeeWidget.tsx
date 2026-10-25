'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { COMMUNITY_LINKS } from '@/lib/community-profiles.mjs'
import { startPolling, fetchWidgetJson } from '@/lib/widget-polling.mjs'
import ModuleHeader from './ModuleHeader'

type CoffeeProfile = {
  name: string; username?: string; avatarUrl?: string; coverUrl?: string; bio?: string
  price: number | null; currency?: string; item: string; supporters: number | null
  memberships: { title: string; price: number; url: string }[]; posts: { title: string; url: string }[]
}

export default function BuyMeACoffeeWidget({ visible }: { visible: Record<string, boolean> }) {
  const [data, setData] = useState<CoffeeProfile | null>(null)
  const [failed, setFailed] = useState(false)
  const show = (part: string) => visible[`buymeacoffee_${part}`] !== false
  useEffect(() => startPolling({ intervalMs: 300_000, poll: async (signal: AbortSignal) => {
    const next = await fetchWidgetJson('/api/community/buymeacoffee', signal) as CoffeeProfile
    if (!signal.aborted) { setData(next); setFailed(false) }
  }, onError: () => setFailed(true) }), [])
  const money = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: data?.currency ?? 'AUD', currencyDisplay: 'code', maximumFractionDigits: 2 }).format(value)
  return <section aria-label="Buy Me a Coffee" className="profile-module w-full space-y-3 text-white">
    {show('cover') && data?.coverUrl && <div className="relative h-24 overflow-hidden rounded-xl"><Image src={data.coverUrl} alt="" fill sizes="(max-width: 640px) 320px, 400px" className="object-cover" unoptimized /></div>}
    <ModuleHeader service="buymeacoffee" title="Buy Me a Coffee" href={COMMUNITY_LINKS.buymeacoffee} name={data?.name ?? 'COOLman'} username={data?.username} avatarUrl={data?.avatarUrl} visible={visible} />
    {!data && !failed && <p role="status" className="animate-pulse text-xs text-white/65">Loading creator page…</p>}
    {failed && <p role="status" className="text-xs text-white/65">Creator details could not refresh.{data ? ' Showing the last available details.' : ''}</p>}
    {show('bio') && data?.bio && <p className="whitespace-pre-line break-words text-xs leading-relaxed text-white/75">{data.bio}</p>}
    <div className="grid grid-cols-2 gap-2 text-center">
      {show('price') && data?.price != null && <div className="rounded-lg bg-white/5 px-2 py-2"><p className="text-sm font-semibold">{money(data.price)}</p><p className="mt-0.5 text-[11px] text-white/60">Buy a {data.item}</p></div>}
      {show('supporters') && data?.supporters != null && <div className="rounded-lg bg-white/5 px-2 py-2"><p className="text-sm font-semibold">{data.supporters.toLocaleString('en-US')}</p><p className="mt-0.5 text-[11px] text-white/60">Supporters</p></div>}
    </div>
    {show('memberships') && !!data?.memberships.length && <div className="space-y-2 border-t border-white/10 pt-2.5"><h3 className="text-[10px] font-bold uppercase tracking-widest text-white/55">Memberships</h3><div className="grid grid-cols-2 gap-2">{data.memberships.map((level) => <a key={level.title} href={level.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white/5 px-2.5 py-2 text-xs hover:bg-white/10"><span className="block truncate font-semibold">{level.title} ↗</span><span className="mt-1 block text-[10px] text-white/60">{money(level.price)} / month</span></a>)}</div></div>}
    {show('posts') && !!data?.posts.length && <div className="space-y-2 border-t border-white/10 pt-2.5"><h3 className="text-[10px] font-bold uppercase tracking-widest text-white/55">Recent public posts</h3>{data.posts.map((post) => <a key={post.url} href={post.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10">{post.title} ↗</a>)}</div>}
    {show('button') && <a href={COMMUNITY_LINKS.buymeacoffee} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-amber-300 px-3 py-2 text-center text-xs font-bold text-amber-950 transition-colors hover:bg-amber-200">Buy me a {data?.item ?? 'coffee'} ↗</a>}
  </section>
}
