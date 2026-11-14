import type { MonitorCoverage, MonitorModelRow, MonitorSnapshot } from '@/api/channelMonitorV2'
import { availabilityState, monitorBucketStarts } from './monitorAvailability'

type TrendPoint = MonitorSnapshot['trend'][number]

/** Align to the requested window and let the latest copy of a bucket win. */
export function serviceTrendSlots(trend: TrendPoint[], coverage: MonitorCoverage | null) {
  const byTime = new Map<number, TrendPoint>()
  for (const point of trend) {
    const time = Date.parse(point.bucket_start)
    if (Number.isFinite(time)) byTime.set(time, point)
  }
  const starts = coverage
    ? monitorBucketStarts(coverage)
    : [...byTime.keys()].sort((a, b) => a - b).map(time => new Date(time).toISOString())
  return starts.map(bucket_start => ({ bucket_start, point: byTime.get(Date.parse(bucket_start)) }))
}

/** Sample coverage measures judged time buckets, independently of redacted volume. */
export function serviceSampleCoverage(snapshot: Pick<MonitorSnapshot, 'coverage' | 'trend'> | null) {
  if (!snapshot) return { count: 0, total: 0, rate: null }
  const slots = serviceTrendSlots(snapshot.trend, snapshot.coverage)
  const count = slots.filter(slot => slot.point && availabilityState(slot.point.health) !== 'unknown').length
  return { count, total: slots.length, rate: slots.length ? count / slots.length : null }
}

/** Rank only judged models with actual errors; ordinary users never sort redacted counts. */
export function serviceRankedModels(rows: MonitorModelRow[], admin: boolean, limit = 5): MonitorModelRow[] {
  const count = (row: MonitorModelRow) => Number.isFinite(row.metrics.error_requests) ? Math.max(0, row.metrics.error_requests) : 0
  return rows.filter(row => availabilityState(row.health) !== 'unknown' &&
    Number.isFinite(row.metrics.error_rate) && row.metrics.error_rate > 0 && row.metrics.error_rate <= 1)
    .sort((a, b) => (admin ? count(b) - count(a) : 0) || b.metrics.error_rate - a.metrics.error_rate ||
      a.platform.localeCompare(b.platform) || a.model.localeCompare(b.model))
    .slice(0, Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 5)
}
