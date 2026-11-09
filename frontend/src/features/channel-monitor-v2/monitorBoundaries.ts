/**
 * Boundary-state helpers for the V2 availability matrix (原型 13 号稿的状态 ②③④).
 *
 * Three states look identical in a sparse matrix but mean different things:
 *   - backfill: the window is older than the aggregated history → the system
 *     simply has not computed it yet. Never a 0%, never a fault.
 *   - no traffic: the window is inside covered history but nobody called the
 *     scope. This is a factual answer for the user, not a system problem.
 *   - filtered empty: the current filter combination selects nothing at all.
 *     Different remediation: drop one condition.
 *
 * Kept pure so the semantics can be locked by unit tests.
 */
import type { MonitorCoverage, MonitorMatrixBucket } from '@/api/channelMonitorV2'

export type SlotState = 'backfill' | 'no-traffic'

/** Oldest instant the aggregated history can answer for. */
export function coverageStartMs(coverage: MonitorCoverage | null | undefined): number {
  if (!coverage) return Number.POSITIVE_INFINITY
  if (coverage.coverage_start) {
    const parsed = Date.parse(coverage.coverage_start)
    if (!Number.isNaN(parsed)) return parsed
  }
  // No watermark yet: nothing is backfilled, so every slot is still filling.
  return Number.POSITIVE_INFINITY
}

/**
 * A slot before the coverage start is still being backfilled. A slot strictly
 * inside covered history without a bucket simply had no traffic.
 */
export function slotStateOf(startIso: string, coverage: MonitorCoverage | null | undefined): SlotState {
  const start = Date.parse(startIso)
  if (Number.isNaN(start)) return 'no-traffic'
  return start < coverageStartMs(coverage) ? 'backfill' : 'no-traffic'
}

export function bucketSlotState(bucket: MonitorMatrixBucket | null | undefined, coverage: MonitorCoverage | null | undefined): SlotState {
  return bucket ? slotStateOf(bucket.bucket_start, coverage) : 'no-traffic'
}

/** Number of visible columns that belong to the still-filling prefix. */
export function backfillSlotCount(starts: string[], coverage: MonitorCoverage | null | undefined): number {
  return starts.reduce((count, start) => count + (slotStateOf(start, coverage) === 'backfill' ? 1 : 0), 0)
}

export function isBackfilling(coverage: MonitorCoverage | null | undefined): boolean {
  return Boolean(coverage && (!coverage.coverage_complete || coverage.bootstrap?.active))
}

/**
 * How to relax an empty filter set. Ordered most-specific first and capped at
 * two, matching 原型 13 号的「试着放宽其中一个条件」.
 */
export function relaxSuggestions(filters: { platforms: string[]; groupIds: number[]; models: string[]; search?: string; issuesOnly?: boolean }): Array<'platform' | 'group' | 'model' | 'search' | 'issues'> {
  const present: Array<'platform' | 'group' | 'model' | 'search' | 'issues'> = []
  if (filters.groupIds?.length) present.push('group')
  if (filters.models?.length) present.push('model')
  if (filters.platforms?.length) present.push('platform')
  if (filters.search?.trim()) present.push('search')
  if (filters.issuesOnly) present.push('issues')
  return present.slice(0, 2)
}

/** True when the matrix has rows but every one of them is still filling. */
export function everySlotBackfilling(starts: string[], coverage: MonitorCoverage | null | undefined): boolean {
  return starts.length > 0 && backfillSlotCount(starts, coverage) === starts.length
}
