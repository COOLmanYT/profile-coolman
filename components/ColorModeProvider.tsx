'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { siteConfig } from '@/lib/site-config.mjs'

type Mode = 'dark' | 'light' | 'system'
const ModeContext = createContext<{ mode: Mode; setMode: (mode: Mode) => void } | null>(null)
export default function ColorModeProvider({ children }: { children: ReactNode }) {
  const appearance = siteConfig.appearance
  const [mode, updateMode] = useState<Mode>(appearance.defaultMode as Mode)
  useEffect(() => {
    if (!appearance.allowModeSwitch) return
    try {
      const saved = localStorage.getItem('profile-color-mode')
      if (saved === 'dark' || saved === 'light' || saved === 'system') updateMode(saved)
    } catch { /* Browser storage is optional. */ }
  }, [appearance])
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: light)')
    const apply = () => { document.documentElement.dataset.colorMode = mode === 'system' ? (query.matches ? 'light' : 'dark') : mode }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [mode])
  const setMode = (next: Mode) => {
    if (!appearance.allowModeSwitch) return
    updateMode(next)
    try { localStorage.setItem('profile-color-mode', next) } catch { /* Browser storage is optional. */ }
  }
  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>
}

export function ColorModeControl() {
  const context = useContext(ModeContext)
  if (!siteConfig.appearance.allowModeSwitch || !context) return null
  return <label className="mt-5 block text-sm">Appearance
    <select aria-label="Colour mode" value={context.mode} onChange={(event) => context.setMode(event.target.value as Mode)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2">
      <option value="dark">Dark</option><option value="light">Light</option><option value="system">Use device setting</option>
    </select>
  </label>
}
