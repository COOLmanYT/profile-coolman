import assert from 'node:assert/strict'
import test from 'node:test'
import { createStatusData } from '../lib/status-components.mjs'

test('converts every Instatus v3 component into a status row and compact summary', () => {
  const result = createStatusData([
    { name: 'COOLman Profile Website', status: 'OPERATIONAL' },
    { name: 'DNS', description: 'Records updating', status: 'UNDERMAINTENANCE', group: { name: 'Vercel' } },
  ])
  assert.deepEqual(result.services, [
    { name: 'COOLman Profile Website', state: 'operational', label: 'OPERATIONAL' },
    { name: 'Vercel — DNS', state: 'maintenance', label: 'Records updating' },
  ])
  assert.equal(result.summary[0].state, 'operational')
  assert.deepEqual(result.summary[1], { name: 'COOLman brand', state: 'maintenance', label: '1/2 components operational' })
})

test('reports an unknown aggregate when Instatus has no component data', () => {
  const result = createStatusData([])
  assert.deepEqual(result.summary[1], { name: 'COOLman brand', state: 'unknown', label: 'No component data available' })
})
