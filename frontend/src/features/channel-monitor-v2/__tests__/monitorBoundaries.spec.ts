import { describe, expect, it } from 'vitest'
import type { MonitorErrorRow } from '@/api/channelMonitorV2'
import {
  backfillSlotCount,
  coverageStartMs,
  everySlotBackfilling,
  isBackfilling,
  relaxSuggestions,
  slotStateOf,
} from '../monitorBoundaries'
import { drilldownConclusion } from '../monitorDrilldown'
import { coverage, health, metrics } from './availabilityFixtures'

const starts = ['2026-10-01T00:00:00Z', '2026-10-01T00:05:00Z', '2026-10-01T00:10:00Z']

function errorRow(category: string, count: number, ignored = false): MonitorErrorRow {
  return { category, count, rate: 0, ignored } as unknown as MonitorErrorRow
}

describe('matrix boundary states (原型 13 状态 ②)', () => {
  it('treats a slot before the coverage start as backfilling, not as no traffic', () => {
    expect(slotStateOf(starts[0], coverage)).toBe('backfill')
    expect(slotStateOf(starts[1], coverage)).toBe('no-traffic')
    expect(slotStateOf(starts[2], coverage)).toBe('no-traffic')
    expect(backfillSlotCount(starts, coverage)).toBe(1)
    expect(everySlotBackfilling(starts, coverage)).toBe(false)
    expect(everySlotBackfilling(starts.slice(0, 1), coverage)).toBe(true)
  })

  it('treats everything as backfilling when no watermark exists yet', () => {
    const empty = { ...coverage, coverage_start: undefined as unknown as string }
    expect(coverageStartMs(empty)).toBe(Number.POSITIVE_INFINITY)
    expect(backfillSlotCount(starts, empty)).toBe(3)
    expect(isBackfilling(empty)).toBe(true)
  })

  it('reports backfilling while history is incomplete or bootstrap is active', () => {
    expect(isBackfilling(coverage)).toBe(true)
    expect(isBackfilling({ ...coverage, coverage_complete: true })).toBe(false)
    expect(isBackfilling({ ...coverage, coverage_complete: true, bootstrap: { active: true, progress_percent: 10 } })).toBe(true)
    expect(isBackfilling(null)).toBe(false)
  })

  it('never parses an invalid start as backfill', () => {
    expect(slotStateOf('not-a-date', coverage)).toBe('no-traffic')
  })
})

describe('empty filter relaxation (原型 13 状态 ④)', () => {
  it('suggests relaxing the narrowest conditions first, capped at two', () => {
    expect(relaxSuggestions({ platforms: ['deepseek'], groupIds: [7], models: ['deepseek-chat'], search: 'x' }))
      .toEqual(['group', 'model'])
    expect(relaxSuggestions({ platforms: [], groupIds: [], models: [], search: '  ', issuesOnly: true })).toEqual(['issues'])
    expect(relaxSuggestions({ platforms: [], groupIds: [], models: [] })).toEqual([])
  })
})

describe('drilldown conclusion (原型 13 归因结论)', () => {
  it('names the dominant owner and offers the matching action', () => {
    const conclusion = drilldownConclusion(
      [errorRow('rate_or_capacity', 74), errorRow('timeout', 16), errorRow('upstream_5xx', 10)],
      { ...metrics(0.2), request_count: 500 },
      health('critical'),
    )
    expect(conclusion.owner).toBe('upstream')
    expect(conclusion.share).toBeCloseTo(1)
    expect(conclusion.category).toBe('rate_or_capacity')
    expect(conclusion.actions).toEqual(['accounts', 'copy'])
  })

  it('routes internal failures to ops monitoring and client failures to ignore', () => {
    const internal = drilldownConclusion([errorRow('transport_or_stream', 3)], { ...metrics(0.05), request_count: 100 }, health('warning'))
    expect(internal.actions).toEqual(['ops', 'copy'])
    const client = drilldownConclusion([errorRow('client_cancelled', 3)], { ...metrics(0.05), request_count: 100 }, health('warning'))
    expect(client.actions).toEqual(['ignore', 'copy'])
  })

  it('refuses to give a verdict below the sample floor', () => {
    const conclusion = drilldownConclusion([errorRow('authentication', 9)], { ...metrics(0.9), request_count: 9 }, health('unknown'))
    expect(conclusion.owner).toBeNull()
    expect(conclusion.share).toBe(0)
    expect(conclusion.actions).toEqual([])
  })

  it('subtracts already ignored errors from the denominator and reports them', () => {
    const conclusion = drilldownConclusion(
      [errorRow('client_cancelled', 40, true), errorRow('timeout', 10)],
      { ...metrics(0.1), request_count: 100 },
      health('warning'),
    )
    expect(conclusion.owner).toBe('upstream')
    expect(conclusion.share).toBeCloseTo(1)
    expect(conclusion.ignoredCount).toBe(40)
  })

  it('reports a clean interval without inventing an owner', () => {
    const conclusion = drilldownConclusion([], { ...metrics(0), request_count: 200 }, health('healthy'))
    expect(conclusion.owner).toBeNull()
    expect(conclusion.actions).toEqual([])
  })
})
