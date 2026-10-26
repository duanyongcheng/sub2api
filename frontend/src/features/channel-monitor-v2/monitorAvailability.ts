import type { HealthState, MonitorCoverage, MonitorHealth, MonitorMatrixRow, MonitorMetric } from '@/api/channelMonitorV2'
import { platformLabel } from '@/utils/platformColors'

export interface AvailabilityEntry {
  row: MonitorMatrixRow
  key: string
  children: MonitorMatrixRow[]
  /** Buckets inside the requested range that have enough samples to score. */
  dataBuckets: number
}

/** Shared state palette for cards, list rows, timelines and legends. */
export const availabilityTone: Record<HealthState, { dot: string; bar: string; value: string; pill: string; ring: string }> = {
  healthy: {
    dot: 'bg-emerald-500', bar: 'bg-emerald-500 dark:bg-emerald-400',
    value: 'text-gray-900 dark:text-white',
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', ring: '',
  },
  warning: {
    dot: 'bg-amber-400', bar: 'bg-amber-400 dark:bg-amber-500',
    value: 'text-amber-600 dark:text-amber-400',
    pill: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', ring: 'ring-1 ring-amber-200 dark:ring-amber-500/30',
  },
  critical: {
    dot: 'bg-rose-500', bar: 'bg-rose-500 dark:bg-rose-400',
    value: 'text-rose-600 dark:text-rose-400',
    pill: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300', ring: 'ring-1 ring-rose-200 dark:ring-rose-500/30',
  },
  unknown: {
    dot: 'bg-gray-300 dark:bg-dark-500', bar: 'bg-gray-200 dark:bg-dark-600',
    value: 'text-gray-400 dark:text-dark-400',
    pill: 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-300', ring: '',
  },
}

/** Child values stay neutral when healthy so issues stand out inside an expanded row. */
export function childValueTone(state: HealthState): string {
  return state === 'healthy' ? 'text-gray-800 dark:text-gray-100' : availabilityTone[state].value
}

/** List header, rows and child rows share one column template so values line up. */
export const AVAILABILITY_LIST_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.5fr)_6.5rem_5.5rem_5.5rem_minmax(0,2.5fr)_2.25rem]'

export const latencyTone: Record<HealthState, string> = {
  healthy: 'text-gray-600 dark:text-gray-300',
  warning: 'text-amber-700 dark:text-amber-400',
  critical: 'text-rose-600 dark:text-rose-400',
  unknown: 'text-gray-400 dark:text-dark-400',
}

/** Average first-token latency against the TTFT budget; backend health.ttft scores P50, not AVG. */
export function averageLatencyState(row: Pick<MonitorMatrixRow, 'metrics' | 'health'>): HealthState {
  const average = row.metrics.ttft.avg_ms
  const thresholds = row.health.thresholds
  if (average == null || !thresholds) return 'unknown'
  if (average >= thresholds.critical_ttft_ms) return 'critical'
  return average >= thresholds.warning_ttft_ms ? 'warning' : 'healthy'
}

function modelLabel(model: string, otherLabel: string) {
  return model === '__other__' ? otherLabel : model
}

/** Card/row title: group and model when present, otherwise the provider name. */
export function monitorRowLabel(row: MonitorMatrixRow, otherLabel: string): string {
  const parts = [row.group_name || (row.group_id ? `#${row.group_id}` : ''), row.model ? modelLabel(row.model, otherLabel) : '']
  return parts.filter(Boolean).join(' / ') || platformLabel(row.platform)
}

/** Child rows only name the dimension the parent does not already show. */
export function monitorChildLabel(child: MonitorMatrixRow, parent: MonitorMatrixRow, otherLabel: string): string {
  const parts = [
    parent.group_id == null ? child.group_name || (child.group_id ? `#${child.group_id}` : '') : '',
    parent.model == null && child.model ? modelLabel(child.model, otherLabel) : '',
  ]
  return parts.filter(Boolean).join(' / ') || monitorRowLabel(child, otherLabel)
}

/** Platform and group rows expand into models; model rows expand into groups. */
export function monitorChildKind(parent: MonitorMatrixRow): 'models' | 'groups' {
  return parent.model == null ? 'models' : 'groups'
}

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
