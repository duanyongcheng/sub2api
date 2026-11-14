import { describe, expect, it } from 'vitest'
import type { MonitorModelRow } from '@/api/channelMonitorV2'
import { serviceRankedModels, serviceSampleCoverage, serviceTrendSlots } from '../serviceDashboard'
import { coverage, health, metrics } from './availabilityFixtures'

function point(bucket_start: string, state: Parameters<typeof health>[0] = 'healthy') {
  return { bucket_start, metrics: metrics(), health: health(state) }
}
function model(name: string, errorRate: number, errors: number, state: Parameters<typeof health>[0] = 'healthy'): MonitorModelRow {
  return { platform: 'openai', model: name, metrics: { ...metrics(errorRate), error_requests: errors }, health: health(state) }
}

describe('service sample coverage', () => {
  it('counts unique judged intervals in the requested window independently of hidden volume and backfill flags', () => {
    const result = serviceSampleCoverage({ coverage, trend: [
      point('2026-10-01T00:00:00Z'), point('2026-10-01T00:05:00Z', 'warning'),
      point('2026-10-01T00:05:00+00:00'), point('2026-10-01T00:10:00Z', 'unknown'),
      point('2026-09-30T23:55:00Z'), point('2026-10-01T00:15:00Z'), point('invalid'),
    ] })
    expect(result).toEqual({ count: 2, total: 3, rate: 2 / 3 })
    expect(coverage.coverage_complete).toBe(false)
  })

  it('uses the last payload for a duplicate interval and leaves missing intervals as gaps', () => {
    const trend = [point('2026-10-01T00:00:00Z'), point('2026-10-01T00:00:00Z', 'unknown')]
    expect(serviceSampleCoverage({ coverage, trend })).toEqual({ count: 0, total: 3, rate: 0 })
    expect(serviceTrendSlots(trend, coverage).map(slot => slot.point?.health.error_rate)).toEqual(['unknown', undefined, undefined])
  })

  it('does not invent a coverage percentage before a window is available', () => {
    expect(serviceSampleCoverage(null)).toEqual({ count: 0, total: 0, rate: null })
    expect(serviceSampleCoverage({ coverage: { ...coverage, requested_start: 'invalid' }, trend: [] }).rate).toBeNull()
  })
})

describe('service model ranking', () => {
  it('sorts administrators by actual errors and ordinary users by rates despite redacted counts', () => {
    const rows = [model('high-volume', 0.01, 100), model('high-rate', 0.3, 4)]
    expect(serviceRankedModels(rows, true).map(row => row.model)).toEqual(['high-volume', 'high-rate'])
    expect(serviceRankedModels(rows.map(row => ({ ...row, metrics: { ...row.metrics, error_requests: 0 } })), false).map(row => row.model)).toEqual(['high-rate', 'high-volume'])
    expect(rows[0].model).toBe('high-volume')
  })

  it('omits insufficient, zero-error and invalid models and applies a stable five-row limit', () => {
    const rows = [model('unknown', 0.9, 999, 'unknown'), model('clean', 0, 999), model('bad', NaN, 999),
      ...['f', 'e', 'd', 'c', 'b', 'a'].map(name => model(name, 0.01, 1))]
    expect(serviceRankedModels(rows, false).map(row => row.model)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(serviceRankedModels(rows, true, 0)).toEqual([])
  })
})
