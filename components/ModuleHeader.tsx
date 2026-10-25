import Image from 'next/image'
import type { ReactNode } from 'react'

export default function ModuleHeader({ service, title, href, name, username, avatarUrl, visible, children }: {
  service: string; title: string; href: string; name: string; username?: string; avatarUrl?: string
  visible: Record<string, boolean>; children?: ReactNode
}) {
  const show = (part: string) => visible[`${service}_${part}`] === true
  return <div className="flex items-center justify-between gap-2">
    <a href={href} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
      {show('avatar') && avatarUrl && <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20"><Image src={avatarUrl} alt="" fill sizes="40px" className="object-cover" unoptimized /></span>}
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white/90"><Image src={`https://cdn.simpleicons.org/${service}/ffffff`} alt="" width={16} height={16} className="h-4 w-4 shrink-0" unoptimized />{title}</h2>
        {show('name') && <p className="mt-0.5 truncate text-xs font-medium group-hover:underline">{name} <span aria-hidden>↗</span></p>}
        {show('username') && username && <p className="truncate text-[10px] text-white/55">{username}</p>}
      </div>
    </a>
    {children}
  </div>
}
