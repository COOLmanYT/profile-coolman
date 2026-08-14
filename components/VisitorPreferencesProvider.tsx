'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type PerceivedLocation = 'auto' | 'australia' | 'outside-australia'
export type VisitorSimulation = {
  timeZone: string | null
  location: PerceivedLocation
  dateTime: string | null
  dateTimeSetAt: number | null
}
export type TemporaryModule = 'spotify' | 'twitch' | 'discord'

type VisitorPreferencesValue = {
  simulation: VisitorSimulation
  setSimulation: (next: VisitorSimulation) => void
  hiddenModules: TemporaryModule[]
  setModuleHidden: (module: TemporaryModule, hidden: boolean) => void
}

const DEFAULT_SIMULATION: VisitorSimulation = { timeZone: null, location: 'auto', dateTime: null, dateTimeSetAt: null }
const VisitorPreferencesContext = createContext<VisitorPreferencesValue | null>(null)

export default function VisitorPreferencesProvider({ children }: { children: ReactNode }) {
  const [simulation, setSimulation] = useState(DEFAULT_SIMULATION)
  const [hiddenModules, setHiddenModules] = useState<TemporaryModule[]>([])
  const setModuleHidden = (module: TemporaryModule, hidden: boolean) => {
    setHiddenModules((current) => hidden ? [...new Set([...current, module])] : current.filter((item) => item !== module))
  }

  return <VisitorPreferencesContext.Provider value={{ simulation, setSimulation, hiddenModules, setModuleHidden }}>{children}</VisitorPreferencesContext.Provider>
}

export function useVisitorPreferences() {
  const context = useContext(VisitorPreferencesContext)
  if (!context) throw new Error('useVisitorPreferences must be used within VisitorPreferencesProvider')
  return context
}
