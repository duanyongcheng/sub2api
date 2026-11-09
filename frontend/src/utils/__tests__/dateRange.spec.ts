import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDateRangeGranularity, getLast24HoursRange, isLast24HoursRange } from '../dateRange'

afterEach(() => vi.useRealTimers())

describe('rolling 24-hour ranges', () => {
  it.each([
    '2026-11-09T00:15:30.456+08:00',
    '2026-03-08T12:30:00-04:00',
    '2026-11-01T12:30:00-05:00',
  ])('preserves exactly 24 elapsed hours at %s', (timestamp) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(timestamp))
    const range = getLast24HoursRange()

    expect(range.end).toBe(new Date(timestamp).toISOString())
    expect(new Date(range.end).getTime() - new Date(range.start).getTime()).toBe(86_400_000)
    expect(isLast24HoursRange(range.start, range.end)).toBe(true)
    expect(getDateRangeGranularity(range.start, range.end)).toBe('hour')
  })

  it('distinguishes a two-day calendar selection from a rolling 24-hour range', () => {
    expect(isLast24HoursRange('2026-11-08', '2026-11-09')).toBe(false)
    expect(isLast24HoursRange('invalid', 'invalid')).toBe(false)
    expect(getDateRangeGranularity('2026-11-01', '2026-11-09')).toBe('day')
    expect(getDateRangeGranularity('2026-11-09', '2026-11-09')).toBe('hour')
  })
})
