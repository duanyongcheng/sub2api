import type { MonitorErrorCategory, MonitorErrorRow, MonitorHealth, MonitorMetric } from '@/api/channelMonitorV2'
import { availabilityValue } from './monitorAvailability'

export const ERROR_OWNERS = ['upstream', 'account', 'client', 'internal'] as const
export type ErrorOwner = typeof ERROR_OWNERS[number]
export type AttributionOwner = ErrorOwner | 'unclassified'

export const CATEGORY_OWNER: Record<MonitorErrorCategory, AttributionOwner> = {
  upstream_5xx: 'upstream', upstream_forbidden: 'upstream', timeout: 'upstream', rate_or_capacity: 'upstream',
  authentication: 'account', quota_or_balance: 'account', account_pool_unavailable: 'account',
  client_cancelled: 'client', invalid_request: 'client', context_limit: 'client', content_policy: 'client', model_unsupported: 'client',
  internal: 'internal', group_access: 'internal', not_found: 'internal', transport_or_stream: 'internal',
  other: 'unclassified',
}

export function errorOwner(category: string): AttributionOwner {
  return CATEGORY_OWNER[category as MonitorErrorCategory] ?? 'unclassified'
}

export function attributionGroups(rows: MonitorErrorRow[]) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  return [...ERROR_OWNERS, 'unclassified' as const].map(owner => {
    const categories = rows.filter(row => errorOwner(row.category) === owner).sort((a, b) => b.count - a.count)
    const count = categories.reduce((sum, row) => sum + row.count, 0)
    const ignoredCount = categories.filter(row => row.ignored).reduce((sum, row) => sum + row.count, 0)
    return { owner, categories, count, ignoredCount, share: total > 0 ? count / total : 0 }
  })
}

/** Error endpoint rates are shares of errors, not shares of all requests. */
export function ignoreImpact(metrics: MonitorMetric, health: MonitorHealth, rows: MonitorErrorRow[], category: string) {
  const current = availabilityValue(metrics, health)
  const target = rows.find(row => row.category === category)
  const classified = rows.reduce((sum, row) => sum + row.count, 0)
  if (current == null || metrics.request_count <= 0 || classified !== metrics.error_requests || !target || target.ignored) return null
  const counted = rows.filter(row => !row.ignored).reduce((sum, row) => sum + row.count, 0)
  // Different aggregation watermarks/config versions must never produce an invented preview.
  if (Math.abs(counted / metrics.request_count - metrics.error_rate) > 0.000001) return null
  return { current, projected: 1 - Math.max(0, counted - target.count) / metrics.request_count }
}
