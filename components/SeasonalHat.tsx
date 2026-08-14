'use client'

import { useSeasonalTheme } from './SeasonalThemeProvider'

export default function SeasonalHat() {
  const { theme } = useSeasonalTheme()
  if (theme !== 'christmas') return null
  return <span className="seasonal-santa-hat" aria-label="Christmas hat" role="img" />
}
