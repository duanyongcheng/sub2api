/**
 * 渠道监控复盘报表（原型 13「复制请求示例」的对偶：把这段窗口的结论带走）。
 *
 * A drilldown answer is only trustworthy if the export carries the same
 * caveats the drawer showed:
 *   - coverage: which part of the window was actually aggregated;
 *   - sample floor: below it, availability is "insufficient", never 0% or 100%;
 *   - attribution: count + share + owner, with ignored errors flagged.
 * Nothing is recomputed here — the caller passes the already-derived values.
 */
import type { MonitorCoverage, MonitorErrorRow, MonitorHealth, MonitorMetric } from '@/api/channelMonitorV2'
import { formatMonitorMs } from './monitorFormat'
import { formatAvailability } from './monitorAvailability'
import { attributionGroups, errorOwner } from './ownership'
import type { WorkbookSheet } from '@/utils/reportExport'
import type { DrilldownConclusion } from './monitorDrilldown'

export interface DrilldownReportLabels {
  sheet: string
  section: string
  item: string
  value: string
  category: string
  count: string
  share: string
  shareOfOwner: string
  owner: string
  ignored: string
  yes: string
  no: string
  scope: string
  window: string
  coverage: string
  coverageComplete: string
  coveragePartial: string
  dataThrough: string
  bucket: string
  availability: string
  requests: string
  errors: string
  ttftP50: string
  ttftP95: string
  healthScore: string
  insufficient: string
  conclusion: string
  ignoredTotal: string
  owners: Record<string, string>
}

export interface DrilldownReportInput {
  label: string
  start: string
  end: string
  snapshot: { coverage: MonitorCoverage; metrics: MonitorMetric; health: MonitorHealth }
  errors: MonitorErrorRow[]
  conclusion: DrilldownConclusion
  labels: DrilldownReportLabels
}

export function buildDrilldownWorkbook(input: DrilldownReportInput): WorkbookSheet[] {
  const { labels: l, snapshot } = input
  const { metrics, health, coverage } = snapshot
  const insufficient = health.error_rate === 'unknown'
  const conclusionText = input.conclusion.owner
    ? `${l.owners[input.conclusion.owner] ?? input.conclusion.owner} · ${(input.conclusion.share * 100).toFixed(1)}%`
    : insufficient ? l.insufficient : ''

  const rows: Array<Array<string | number | null | undefined>> = [
    [l.section, l.item, l.value],
    [l.scope, input.start, input.end],
    [l.window, input.label, ''],
    [l.coverage, coverage.coverage_complete ? l.coverageComplete : l.coveragePartial, coverage.coverage_start],
    [l.dataThrough, coverage.data_through, ''],
    [l.bucket, coverage.bucket_seconds, ''],
    ['', '', ''],
    [l.section, l.item, l.value],
    ['', l.availability, formatAvailability(metrics, health)],
    ['', l.requests, metrics.request_count],
    ['', l.errors, metrics.error_requests],
    ['', l.ttftP50, formatMonitorMs(metrics.ttft.p50_ms)],
    ['', l.ttftP95, formatMonitorMs(metrics.ttft.p95_ms)],
    ['', l.healthScore, health.score == null ? l.insufficient : health.score],
    ['', l.conclusion, conclusionText],
    ['', l.ignoredTotal, input.conclusion.ignoredCount],
    ['', '', ''],
    [l.section, l.category, l.count, l.share, l.owner, l.shareOfOwner, l.ignored],
  ]

  const total = input.errors.reduce((sum, row) => sum + row.count, 0)
  const groups = attributionGroups(input.errors)
  for (const row of [...input.errors].sort((a, b) => b.count - a.count)) {
    const owner = errorOwner(row.category)
    const ownerCount = groups.find(group => group.owner === owner)?.count ?? row.count
    rows.push([
      '',
      row.category,
      row.count,
      total > 0 ? Number((row.count / total).toFixed(4)) : 0,
      l.owners[owner] ?? owner,
      // Share of the owner's total, so the two levels cannot be confused.
      ownerCount > 0 ? Number((row.count / ownerCount).toFixed(4)) : 0,
      row.ignored ? l.yes : l.no,
    ])
  }

  return [{ name: l.sheet, rows }]
}
