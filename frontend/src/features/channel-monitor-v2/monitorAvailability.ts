import type { HealthState, MonitorCoverage, MonitorHealth, MonitorMatrixRow, MonitorMetric } from '@/api/channelMonitorV2'

/** Availability is independent of latency/cache scoring and of redacted counts. */
export function availabilityState(health?: MonitorHealth): HealthState {
  return health?.error_rate || 'unknown'
}

export function availabilityValue(metrics: MonitorMetric, health: MonitorHealth): number | null {
  if (availabilityState(health) === 'unknown' || !Number.isFinite(metrics.error_rate)) return null
  return Math.max(0, Math.min(1, 1 - metrics.error_rate))
}

export function formatAvailability(metrics: MonitorMetric, health: MonitorHealth): string {
  const value = availabilityValue(metrics, health)
  return value == null ? '—' : `${(value * 100).toFixed(2)}%`
}

export function monitorRowKey(row: MonitorMatrixRow): string {
  return JSON.stringify([row.platform, row.group_id ?? null, row.model ?? null])
}

/** Align sparse data to the entire requested range, including unfilled history. */
export function monitorBucketStarts(coverage: MonitorCoverage): string[] {
  const step = Math.max(60, coverage.bucket_seconds) * 1000
  const start = Date.parse(coverage.requested_start)
  const requestedEnd = Date.parse(coverage.requested_end || '')
  const end = Number.isFinite(requestedEnd) && requestedEnd > start
    ? requestedEnd : Date.parse(coverage.data_through)
  if (![start, end, step].every(Number.isFinite) || start >= end) return []
  const starts: string[] = []
  // Product ranges have at most a few dozen buckets; cap malformed API payloads.
  for (let cursor = Math.floor(start / step) * step; cursor < end && starts.length < 2000; cursor += step) {
    starts.push(new Date(cursor).toISOString())
  }
  return starts
}

export const availabilitySeverity: Record<HealthState, number> = {
  critical: 0, warning: 1, healthy: 2, unknown: 3,
}

export function isAvailabilityIssue(health: MonitorHealth): boolean {
  return ['warning', 'critical'].includes(availabilityState(health))
}

/** Children are display-only. Headline rates always come from server aggregates. */
export function monitorChildren(row: MonitorMatrixRow, children: MonitorMatrixRow[]): MonitorMatrixRow[] {
  return children.filter(child => child.platform === row.platform &&
    (row.group_id == null || child.group_id === row.group_id) &&
    (row.model == null || child.model === row.model) && monitorRowKey(child) !== monitorRowKey(row))
}
