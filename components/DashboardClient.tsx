'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { responseErrorCode, useToast } from './ToastProvider'
import { DASHBOARD_LABELS, DASHBOARD_GROUPS, isControlDisabled } from '@/lib/dashboard-controls.mjs'

interface DashboardClientProps {
  initialToggles: Record<string, boolean>
  signOutOnly?: boolean
  onTogglesChange?: (toggles: Record<string, boolean>) => void
}


export default function DashboardClient({ initialToggles, signOutOnly, onTogglesChange }: DashboardClientProps) {
  const { showToast } = useToast()
  const [toggles, setToggles] = useState(initialToggles)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  if (signOutOnly) {
    return (
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        Sign Out
      </button>
    )
  }

  const handleToggle = async (key: string) => {
    const newValue = !toggles[key]
    setToggles((prev) => {
      const next = { ...prev, [key]: newValue }
      onTogglesChange?.(next)
      return next
    })
    setSaving(key)
    try {
      const response = await fetch('/api/dashboard/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, value: newValue }),
      })
      if (!response.ok) throw new Error(await responseErrorCode(response))
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
      showToast({ variant: 'success', title: `${labelFor(key)} ${newValue ? 'enabled' : 'disabled'}` })
    } catch (error) {
      setToggles((prev) => {
        const next = { ...prev, [key]: !newValue }
        onTogglesChange?.(next)
        return next
      })
      showToast({ variant: 'error', title: 'Could not save profile setting', code: error instanceof Error ? error.message : 'NETWORK_ERROR' })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      <h2 className="text-white/80 text-sm font-semibold uppercase tracking-wider">Global profile controls</h2>
      <p className="mt-1 text-xs text-white/55">Saved for all visitors. Turn off an entire module or choose its individual elements. Visitor Options can hide enabled elements in their own browser.</p>
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
      {DASHBOARD_GROUPS.map(({ title, description, parentKey, keys }) => (
        <section key={title} aria-label={`${title} global settings`} className="min-w-0 rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <div className="mb-2 px-1">
            <h3 className="text-white text-sm font-semibold">{title}</h3>
            <p className="mt-0.5 text-xs text-white/45">{description}</p>
          </div>
          <div className="space-y-2">
            {keys.map((key) => {
              const label = DASHBOARD_LABELS[key]
              const disabledByParent = isControlDisabled(key, parentKey, toggles)
              return (
                <div key={key} className={`flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 transition-opacity ${disabledByParent ? 'opacity-45' : ''}`}>
                  <span className={`text-sm font-medium text-white ${key !== parentKey ? 'pl-3' : ''}`}>{key !== parentKey && <span aria-hidden className="mr-1.5 text-white/35">↳</span>}{label}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {saved === key && <span className="text-green-400 text-xs">Saved!</span>}
                    <button
                      onClick={() => handleToggle(key)}
                      disabled={saving !== null || disabledByParent}
                      role="switch"
                      aria-checked={toggles[key]}
                      aria-label={`${title} — ${label}: ${toggles[key] ? 'enabled' : 'disabled'}`}
                      title={`${label}: ${toggles[key] ? 'enabled' : 'disabled'}`}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        toggles[key] ? 'bg-red-600' : 'bg-white/20'
                      } ${saving !== null || disabledByParent ? 'cursor-not-allowed opacity-50' : ''} shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          toggles[key] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
      </div>
    </div>
  )
}

function labelFor(key: string) {
  return DASHBOARD_LABELS[key] ?? 'Setting'
}
