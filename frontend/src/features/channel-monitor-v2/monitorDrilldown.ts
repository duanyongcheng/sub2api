/**
 * Drilldown conclusion + available actions (原型 13 号稿「归因结论」区块).
 *
 * The drawer already shows the owner breakdown; what it lacks is the sentence
 * an operator can act on ("74% of failures here come from upstream 429, your
 * config is not involved") plus the three buttons the prototype puts under it.
 * Everything here is derived, never invented: an action only appears when the
 * data needed to execute it exists.
 */
import type { MonitorErrorRow, MonitorHealth, MonitorMetric } from '@/api/channelMonitorV2'
import { attributionGroups, type AttributionOwner } from './ownership'

export type DrilldownAction = 'accounts' | 'ops' | 'ignore' | 'copy'

export interface DrilldownConclusion {
  /** The owner responsible for the largest counted share, null when nothing was counted. */
  owner: AttributionOwner | null
  /** Share of all counted errors carried by that owner, 0–1. */
  share: number
  /** Leading error category of that owner. */
  category: string | null
  categoryCount: number
  /** Counted errors that the current configuration ignores — excluded from availability. */
  ignoredCount: number
  actions: DrilldownAction[]
}

/**
 * One sentence per owner, so the drawer explains rather than enumerates.
 * The wording mirrors 03 §3.3 (upstream: "与你方配置无关"; account: "立即刷新即可消除").
 */
export function drilldownConclusion(
  rows: MonitorErrorRow[],
  metrics: MonitorMetric,
  health: MonitorHealth,
): DrilldownConclusion {
  const counted = rows.filter(row => !row.ignored && row.count > 0)
  const ignoredCount = rows.reduce((sum, row) => sum + (row.ignored ? row.count : 0), 0)
  const groups = attributionGroups(rows)
    .filter(group => group.owner !== 'unclassified' || group.count > 0)
    .filter(group => group.categories.some(row => !row.ignored))
    .sort((a, b) => b.count - a.count)
  const countedTotal = counted.reduce((sum, row) => sum + row.count, 0)
  const top = groups[0] || null
  // Availability is unknown below the sample floor: a percentage would be an invention.
  const judged = health.error_rate !== 'unknown' && metrics.request_count > 0
  const actions: DrilldownAction[] = []
  if (top) {
    if (top.owner === 'account' || top.owner === 'upstream') actions.push('accounts')
    if (top.owner === 'internal' || top.owner === 'unclassified') actions.push('ops')
    if (top.owner === 'client') actions.push('ignore')
    actions.push('copy')
  }
  return {
    owner: judged && top ? top.owner : null,
    share: judged && top && countedTotal > 0 ? top.count / countedTotal : 0,
    category: judged && top ? top.categories[0]?.category ?? null : null,
    categoryCount: judged && top ? top.categories[0]?.count ?? 0 : 0,
    ignoredCount,
    actions: judged ? actions : [],
  }
}
