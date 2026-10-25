'use client'

import type { ReactNode } from 'react'
import { useVisitorPreferences } from './VisitorPreferencesProvider'

export default function VisitorModule({ id, children }: { id: string; children: ReactNode }) {
  const { hiddenModules, visibilityLoaded } = useVisitorPreferences()
  return visibilityLoaded && !hiddenModules.includes(id) ? children : null
}
