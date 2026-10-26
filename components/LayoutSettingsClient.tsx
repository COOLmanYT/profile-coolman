'use client'

import { useState } from 'react'
import { siteConfig, configuredGroups } from '@/lib/site-config.mjs'
import { DASHBOARD_LABELS } from '@/lib/dashboard-controls.mjs'
import { FEATURE_ORDER_GROUPS } from '@/lib/layout-order.mjs'
import type { LayoutSettings } from './FeatureLayout'
import { useToast } from './ToastProvider'

function move(items: string[], index: number, step: number) {
  const next = [...items], target = index + step
  if (target < 0 || target >= items.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
export default function LayoutSettingsClient({ initialLayout, onChange }: { initialLayout: LayoutSettings; onChange: (layout: LayoutSettings) => void }) {
  const [layout, setLayout] = useState(initialLayout)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const labels = Object.fromEntries(configuredGroups().map(group => [group.parentKey, group.title]))
  const update = (next: LayoutSettings) => { setLayout(next); onChange(next) }
  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/dashboard/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'layout', value: layout }) })
      if (!response.ok) throw new Error('Could not save layout')
      showToast({ variant: 'success', title: 'Module and feature order saved' })
    } catch { showToast({ variant: 'error', title: 'Could not save layout' }) }
    finally { setSaving(false) }
  }
  const rows = (items: string[], updateItems: (items: string[]) => void, names: Record<string, string>) => items.map((id, index) => <li key={id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
    <span className="min-w-0 text-sm text-white/85">{names[id] ?? id}</span><span className="flex shrink-0 gap-1">
      {[-1, 1].map(step => <button key={step} type="button" disabled={saving || index + step < 0 || index + step >= items.length} onClick={() => updateItems(move(items, index, step))} aria-label={`Move ${names[id] ?? id} ${step < 0 ? 'up' : 'down'}`} className="rounded border border-white/15 px-2 py-1 text-xs text-white disabled:opacity-25">{step < 0 ? '↑' : '↓'}</button>)}
    </span></li>)
  if (!siteConfig.dashboard.features.ordering) return null
  return <section className="rounded-xl border border-white/10 bg-white/5 p-4">
    <h2 className="text-sm font-semibold text-white">Module and feature order</h2>
    <p className="mt-1 text-xs text-white/50">Move items, check the profile preview, then save. Features stay within their logical parent, such as profile details or activity statistics.</p>
    <ol className="mt-3 space-y-1.5">{rows(layout.moduleOrder, moduleOrder => update({ ...layout, moduleOrder }), labels)}</ol>
    <div className="mt-4 space-y-2">{layout.moduleOrder.map(id => {
      const order = layout.featureOrder[id] ?? []
      const groups = FEATURE_ORDER_GROUPS[id as keyof typeof FEATURE_ORDER_GROUPS] ?? { Features: order.map(key => key.slice(id.length + 1)) }
      return Object.entries(groups).map(([label, parts]) => {
        const items = order.filter(key => (parts as string[]).some(part => key === `${id}_${part}`))
        if (items.length < 2) return null
        return <details key={`${id}-${label}`} className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-sm text-white/80">{labels[id]} · {label}</summary><ol className="mt-3 space-y-1.5">{rows(items, next => {
          let index = 0
          const combined = order.map(key => items.includes(key) ? next[index++] : key)
          update({ ...layout, featureOrder: { ...layout.featureOrder, [id]: combined } })
        }, DASHBOARD_LABELS)}</ol></details>
      })
    })}</div>
    <button type="button" onClick={save} disabled={saving} className="mt-4 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save order'}</button>
  </section>
}
