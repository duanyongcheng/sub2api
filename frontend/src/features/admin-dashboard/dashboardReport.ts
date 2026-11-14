/**
 * 运营概览报表（原型 03「导出报表」）。
 *
 * The dashboard explains itself with headers like "实际 / 标准" and "毛利 = 实际 − 上游成本";
 * the exported sheet must keep that reasoning, otherwise the numbers get
 * re-interpreted by whoever opens the file. Rules:
 *   - Revenue uses actual_cost (what the customer was billed), never cost.
 *   - Margin is unknown when there is no revenue: written as the caller's
 *     "not available" label, not as 0% or -100%.
 *   - Group rows carry account_cost only when the API returned it; a missing
 *     cost is "not available" rather than 0, because 0 would look like 100% margin.
 */
import type { GroupStat, ModelStat, TrendDataPoint } from '@/types'
import type { WorkbookSheet } from '@/utils/reportExport'

export interface DashboardReportInput {
  startDate: string
  endDate: string
  /** Label for a value that cannot be computed in this input (e.g. 数据不足). */
  unavailable: string
  totals: { requests: number; standard: number; actual: number; accountCost: number; margin: number | null }
  trend: TrendDataPoint[]
  groups: GroupStat[]
  models: ModelStat[]
  labels: DashboardReportLabels
}

export interface DashboardReportLabels {
  summarySheet: string
  trendSheet: string
  groupsSheet: string
  modelsSheet: string
  header: {
    item: string; value: string; basis: string
    period: string; requests: string; inputTokens: string; outputTokens: string
    cacheRead: string; cacheCreation: string; totalTokens: string
    standardCost: string; actualCost: string
    group: string; groupId: string; model: string
    accountCost: string; margin: string; marginRate: string
  }
  row: {
    period: string; requests: string; standardRevenue: string; actualRevenue: string
    upstreamCost: string; grossMargin: string; marginRate: string
  }
  basis: {
    actualRevenue: string; standardRevenue: string; upstreamCost: string; grossMargin: string; marginRate: string
  }
}

/** Margin rate in percent, or null when revenue cannot support a percentage. */
export function marginRate(actual: number, accountCost: number): number | null {
  if (!(actual > 0)) return null
  return ((actual - accountCost) / actual) * 100
}

function money(value: number | null | undefined): number | string | null {
  return value == null || Number.isNaN(Number(value)) ? null : Number(Number(value).toFixed(6))
}

function ratio(value: number | null): number | null {
  return value == null ? null : Number(value.toFixed(4))
}

export function buildDashboardWorkbook(input: DashboardReportInput): WorkbookSheet[] {
  const { labels, unavailable } = input
  const h = labels.header

  const summary: WorkbookSheet = {
    name: labels.summarySheet,
    rows: [
      [h.item, h.value, h.basis],
      [labels.row.period, `${input.startDate} ~ ${input.endDate}`, ''],
      [labels.row.requests, input.totals.requests, ''],
      [labels.row.standardRevenue, money(input.totals.standard), labels.basis.standardRevenue],
      [labels.row.actualRevenue, money(input.totals.actual), labels.basis.actualRevenue],
      [labels.row.upstreamCost, money(input.totals.accountCost), labels.basis.upstreamCost],
      [labels.row.grossMargin, money(input.totals.actual - input.totals.accountCost), labels.basis.grossMargin],
      [labels.row.marginRate, ratio(input.totals.margin), labels.basis.marginRate],
    ],
  }

  const trend: WorkbookSheet = {
    name: labels.trendSheet,
    rows: [
      [h.period, h.requests, h.inputTokens, h.outputTokens, h.cacheRead, h.cacheCreation, h.totalTokens, h.standardCost, h.actualCost],
      ...input.trend.map(point => [
        point.date,
        Number(point.requests || 0),
        Number(point.input_tokens || 0),
        Number(point.output_tokens || 0),
        Number(point.cache_read_tokens || 0),
        Number(point.cache_creation_tokens || 0),
        Number(point.total_tokens || 0),
        money(point.cost),
        money(point.actual_cost),
      ]),
    ],
  }

  const groups: WorkbookSheet = {
    name: labels.groupsSheet,
    rows: [
      [h.group, h.groupId, h.requests, h.totalTokens, h.standardCost, h.actualCost, h.accountCost, h.margin, h.marginRate],
      ...input.groups.map(group => {
        const actual = Number(group.actual_cost || 0)
        const cost = group.account_cost == null ? null : Number(group.account_cost)
        // A missing account cost must not read as 100% margin.
        const margin = cost == null ? null : actual - cost
        return [
          group.group_name || `#${group.group_id}`,
          group.group_id,
          Number(group.requests || 0),
          Number(group.total_tokens || 0),
          money(group.cost),
          money(actual),
          cost == null ? unavailable : money(cost),
          margin == null ? unavailable : money(margin),
          margin == null ? unavailable : ratio(marginRate(actual, cost as number)),
        ]
      }),
    ],
  }

  const models: WorkbookSheet = {
    name: labels.modelsSheet,
    rows: [
      [h.model, h.requests, h.inputTokens, h.outputTokens, h.cacheRead, h.cacheCreation, h.totalTokens, h.standardCost, h.actualCost],
      ...input.models.map(model => [
        model.model,
        Number(model.requests || 0),
        Number(model.input_tokens || 0),
        Number(model.output_tokens || 0),
        Number(model.cache_read_tokens || 0),
        Number(model.cache_creation_tokens || 0),
        Number(model.total_tokens || 0),
        money(model.cost),
        money(model.actual_cost),
      ]),
    ],
  }

  return [summary, trend, groups, models]
}
