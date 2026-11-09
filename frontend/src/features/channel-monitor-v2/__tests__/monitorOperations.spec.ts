import { describe, expect, it } from 'vitest'
import { MONITOR_ERROR_CATEGORIES } from '@/api/channelMonitorV2'
import { availabilityState } from '../monitorAvailability'
import { attributionGroups, CATEGORY_OWNER, errorOwner, ignoreImpact } from '../ownership'
import { fixedMonitorFilter, operationsRows, operationsState, scoreTone } from '../monitorOperations'
import { coverage, health, metrics, row } from './availabilityFixtures'

describe('admin monitor display bands', () => {
  it('uses the documented availability boundaries without replacing health scores', () => {
    expect(operationsState(metrics(0.01), health('healthy'))).toBe('healthy')
    expect(operationsState(metrics(0.1), health('warning'))).toBe('warning')
    expect(operationsState(metrics(0.10001), health('critical'))).toBe('critical')
    expect(operationsState(metrics(0.8), health('unknown'))).toBe('unknown')
    expect(availabilityState(health('critical'))).toBe('critical')
    expect(scoreTone({ ...health(), score: 80 })).toBe('ok')
    expect(scoreTone({ ...health(), score: 79 })).toBe('warn')
    expect(scoreTone({ ...health(), score: 49.9 })).toBe('bad')
    expect(scoreTone({ ...health(), score: null })).toBe('neutral')
  })

  it('keeps abnormal rows first, then unknown evidence, and filters only abnormal rows', () => {
    const sorted = operationsRows([
      row({ model: 'normal', metrics: metrics(0.01), health: health('healthy') }),
      row({ model: 'unknown', metrics: metrics(0), health: health('unknown') }),
      row({ model: 'warning', metrics: metrics(0.04), health: health('warning') }),
      row({ model: 'critical', metrics: metrics(0.6), health: health('critical') }),
    ], '', false)
    expect(sorted.map(item => item.model)).toEqual(['critical', 'warning', 'unknown', 'normal'])
    expect(operationsRows(sorted, '', true).map(item => item.model)).toEqual(['critical', 'warning'])
    expect(operationsRows(sorted, 'UNKNOWN', false).map(item => item.model)).toEqual(['unknown'])
  })

  it('pins a selected matrix cell to one original bucket and preserves the concrete dimensions', () => {
    const selected = row({ platform: 'openai', group_id: 18, group_name: 'North', model: 'gpt-5' })
    expect(fixedMonitorFilter({ range: '24h', platforms: [], groupIds: [], models: [] }, coverage, selected, '2026-10-01T00:05:00.000Z')).toMatchObject({
      platforms: ['openai'], groupIds: [18], models: ['gpt-5'],
      start: '2026-10-01T00:05:00.000Z', end: '2026-10-01T00:10:00.000Z',
    })
    expect(fixedMonitorFilter({ range: '24h', platforms: ['grok'], groupIds: [7], models: [] }, coverage)).toMatchObject({
      platforms: ['grok'], groupIds: [7], start: coverage.requested_start, end: coverage.requested_end,
    })
  })
})

describe('error ownership and ignore preview', () => {
  it('maps every backend taxonomy category and leaves unknown categories explicit', () => {
    expect(Object.keys(CATEGORY_OWNER).sort()).toEqual([...MONITOR_ERROR_CATEGORIES].sort())
    expect(errorOwner('rate_or_capacity')).toBe('upstream')
    expect(errorOwner('authentication')).toBe('account')
    expect(errorOwner('client_cancelled')).toBe('client')
    expect(errorOwner('transport_or_stream')).toBe('internal')
    expect(errorOwner('new_backend_category')).toBe('unclassified')
  })

  it('groups by error count and keeps the API error-share denominator', () => {
    const groups = attributionGroups([
      { category: 'timeout', count: 6, rate: 0.6, ignored: false },
      { category: 'client_cancelled', count: 4, rate: 0.4, ignored: true },
      { category: 'new_backend_category', count: 1, rate: 0.1, ignored: false },
    ])
    expect(groups.find(group => group.owner === 'upstream')).toMatchObject({ count: 6, share: 6 / 11, ignoredCount: 0 })
    expect(groups.find(group => group.owner === 'client')).toMatchObject({ count: 4, ignoredCount: 4 })
    expect(groups.find(group => group.owner === 'unclassified')).toMatchObject({ count: 1, share: 1 / 11 })
  })

  it('previews one newly ignored counted category without adding ignored errors to success', () => {
    const currentMetrics = { ...metrics(0.07), request_count: 100, error_requests: 10, success_requests: 90 }
    const healthData = { ...health('healthy'), error_rate: 'healthy' as const }
    const errors = [
      { category: 'rate_or_capacity', count: 7, rate: 0.7, ignored: false },
      { category: 'client_cancelled', count: 3, rate: 0.3, ignored: true },
    ]
    expect(ignoreImpact(currentMetrics, healthData, errors, 'rate_or_capacity')).toMatchObject({ projected: 1 })
    expect(ignoreImpact(currentMetrics, healthData, errors, 'rate_or_capacity')?.current).toBeCloseTo(0.93)
    expect(ignoreImpact(currentMetrics, healthData, errors, 'client_cancelled')).toBeNull()
    expect(ignoreImpact(currentMetrics, healthData, errors.slice(0, 1), 'rate_or_capacity')).toBeNull()
    expect(ignoreImpact({ ...currentMetrics, request_count: 0 }, healthData, errors, 'rate_or_capacity')).toBeNull()
  })
})
