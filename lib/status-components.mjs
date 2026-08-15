const STATE_PRIORITY = { operational: 0, maintenance: 1, degraded: 2, outage: 3, unknown: 4 }

export function normaliseStatusState(value) {
  const state = value?.toLowerCase() ?? ''
  if (state.includes('operational') || state === 'up' || state === 'ok') return 'operational'
  if (state.includes('maintenance')) return 'maintenance'
  if (state.includes('degraded') || state.includes('partial') || state.includes('minor')) return 'degraded'
  if (state.includes('major') || state.includes('down') || state.includes('outage')) return 'outage'
  return 'unknown'
}

export function createStatusData(components) {
  const services = components.map((component) => ({
    name: component.group?.name?.trim() ? `${component.group.name.trim()} — ${component.name}` : component.name,
    state: normaliseStatusState(component.status),
    label: component.description?.trim() || component.status || 'Status unavailable',
  }))
  const profile = components.find((component) => component.name?.trim().toLowerCase() === 'coolman profile website')
  const aggregate = services.length === 0 ? 'unknown' : services.reduce((worst, service) => STATE_PRIORITY[service.state] > STATE_PRIORITY[worst] ? service.state : worst, 'operational')
  const operationalCount = services.filter((service) => service.state === 'operational').length
  return {
    services,
    summary: [
      { name: 'Profile page', state: profile ? normaliseStatusState(profile.status) : 'unknown', label: profile?.status ?? 'Not separately tracked' },
      { name: 'COOLman brand', state: aggregate, label: services.length ? `${operationalCount}/${services.length} components operational` : 'No component data available' },
    ],
  }
}
