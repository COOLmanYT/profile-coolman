import Link from 'next/link'
import StatusPageClient from '@/components/StatusPageClient'

export const metadata = { title: 'Status | COOLman', description: 'Live status for COOLman services and components.' }

export default function StatusPage() {
  return <main className="min-h-screen bg-[#151515] px-5 py-10 text-white"><article className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><Link href="/" className="text-xs text-white/45 hover:text-white">← Back to profile</Link><h1 className="mt-5 text-2xl font-bold">COOLman Status</h1><p className="mt-1 text-sm text-white/55">Live status from the COOLman component monitor.</p></div><a href="https://status.coolmanyt.com" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/75 hover:bg-white/10">Open Instatus ↗</a></div><StatusPageClient /></article></main>
}
