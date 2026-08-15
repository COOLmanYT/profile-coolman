'use client'

import { useState } from 'react'
import DashboardClient from './DashboardClient'
import ProfileCard from './ProfileCard'
import { useToast } from './ToastProvider'

export default function DashboardWorkspace({ initialToggles }: { initialToggles: Record<string, boolean> }) {
  const [toggles, setToggles] = useState(initialToggles)
  const [preview, setPreview] = useState(false)
  const { showToast } = useToast()
  const togglePreview = () => setPreview((value) => { showToast({ variant: 'success', title: value ? 'Dashboard preview hidden' : 'Dashboard preview shown' }); return !value })
  return (
    <>
      <DashboardClient initialToggles={initialToggles} onTogglesChange={setToggles} />
      <button onClick={togglePreview} className="mt-6 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
        {preview ? 'Hide profile preview' : 'Preview profile'}
      </button>
      {preview && <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">Live preview</p><div className="mx-auto max-w-[460px]"><ProfileCard toggles={toggles} preview /></div></section>}
    </>
  )
}
