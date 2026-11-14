import type { HealthState, MonitorCoverage, MonitorFilter, MonitorHealth, MonitorMatrixRow, MonitorMetric } from '@/api/channelMonitorV2'
import { availabilityValue, monitorRowKey } from './monitorAvailability'

/** Display bands are independent of the configurable backend health score. */
export function operationsState(metrics: MonitorMetric, health: MonitorHealth): HealthState {
  if (availabilityValue(metrics, health) == null) return 'unknown'
  if (metrics.error_rate <= 0.01) return 'healthy'
  return metrics.error_rate <= 0.1 ? 'warning' : 'critical'
}

export const operationsSeverity: Record<HealthState, number> = { critical: 0, warning: 1, unknown: 2, healthy: 3 }

export function isOperationsIssue(row: Pick<MonitorMatrixRow, 'metrics' | 'health'>): boolean {
  return ['warning', 'critical'].includes(operationsState(row.metrics, row.health))
}

export function scoreTone(health: MonitorHealth): 'ok' | 'warn' | 'bad' | 'neutral' {
  const score = health.score
  if (score == null || !Number.isFinite(score)) return 'neutral'
  return score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'bad'
}

export function fixedMonitorFilter(filter: MonitorFilter, coverage: MonitorCoverage, row?: MonitorMatrixRow, bucketStart?: string): MonitorFilter {
  return {
    ...filter,
    platforms: row ? [row.platform] : [...filter.platforms],
    groupIds: row?.group_id != null ? [row.group_id] : [...filter.groupIds],
    models: row?.model ? [row.model] : [...filter.models],
    start: bucketStart || coverage.requested_start,
    end: bucketStart
      ? new Date(Date.parse(bucketStart) + coverage.bucket_seconds * 1000).toISOString()
      : coverage.requested_end,
  }
}

export function operationsRows(rows: MonitorMatrixRow[], search: string, issuesOnly: boolean): MonitorMatrixRow[] {
  const query = search.trim().toLocaleLowerCase()
  return rows.filter(row => (!issuesOnly || isOperationsIssue(row)) &&
    (!query || [row.platform, row.group_name, row.model, row.group_id].join(' ').toLocaleLowerCase().includes(query)))
    .sort((a, b) => operationsSeverity[operationsState(a.metrics, a.health)] - operationsSeverity[operationsState(b.metrics, b.health)] ||
      b.metrics.error_rate - a.metrics.error_rate || monitorRowKey(a).localeCompare(monitorRowKey(b)))
}
