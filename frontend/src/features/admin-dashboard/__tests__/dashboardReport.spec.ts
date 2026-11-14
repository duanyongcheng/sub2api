import { describe, expect, it } from 'vitest'
import type { GroupStat, ModelStat, TrendDataPoint } from '@/types'
import { buildDashboardWorkbook, marginRate } from '../dashboardReport'
import type { DashboardReportLabels } from '../dashboardReport'

const labels: DashboardReportLabels = {
  summarySheet: 'Summary', trendSheet: 'Trend', groupsSheet: 'Groups', modelsSheet: 'Models',
  header: {
    item: 'Item', value: 'Value', basis: 'Basis',
    period: 'Period', requests: 'Requests', inputTokens: 'In', outputTokens: 'Out',
    cacheRead: 'CacheR', cacheCreation: 'CacheW', totalTokens: 'Total',
    standardCost: 'Standard', actualCost: 'Actual',
    group: 'Group', groupId: 'GroupId', model: 'Model',
    accountCost: 'Upstream', margin: 'Margin', marginRate: 'Margin %',
  },
  row: {
    period: 'Range', requests: 'Requests', standardRevenue: 'Std', actualRevenue: 'Rev',
    upstreamCost: 'Cost', grossMargin: 'Gross', marginRate: 'Rate',
  },
  basis: {
    actualRevenue: 'billed', standardRevenue: 'official', upstreamCost: 'account', grossMargin: 'gross', marginRate: 'rate',
  },
}

function group(overrides: Partial<GroupStat> = {}): GroupStat {
  return { group_id: 7, group_name: 'Claude Pro', requests: 100, total_tokens: 1000, cost: 12, actual_cost: 10, account_cost: 6, ...overrides }
}

describe('dashboard report', () => {
  it('keeps the margin formula and basis in the summary sheet', () => {
    const [summary] = buildDashboardWorkbook({
      startDate: '2026-11-02', endDate: '2026-11-08', unavailable: 'n/a',
      totals: { requests: 1000, standard: 120, actual: 100, accountCost: 60, margin: 40 },
      trend: [], groups: [], models: [], labels,
    })
    expect(summary.name).toBe('Summary')
    expect(summary.rows[0]).toEqual(['Item', 'Value', 'Basis'])
    const byItem = new Map(summary.rows.map(row => [row[0], row]))
    expect(byItem.get('Range')?.[1]).toBe('2026-11-02 ~ 2026-11-08')
    expect(byItem.get('Rev')?.[1]).toBe(100)
    expect(byItem.get('Gross')?.[1]).toBe(40)
    expect(byItem.get('Rate')?.[1]).toBe(40)
    // The basis column is what stops a reader from re-deriving revenue from cost.
    expect(byItem.get('Rev')?.[2]).toBe('billed')
    expect(byItem.get('Cost')?.[2]).toBe('account')
  })

  it('writes unavailable instead of a fake margin rate when revenue is zero', () => {
    expect(marginRate(0, 10)).toBeNull()
    const [summary] = buildDashboardWorkbook({
      startDate: '2026-11-02', endDate: '2026-11-08', unavailable: 'n/a',
      totals: { requests: 0, standard: 0, actual: 0, accountCost: 0, margin: null },
      trend: [], groups: [], models: [], labels,
    })
    expect(summary.rows.find(row => row[0] === 'Rate')?.[1]).toBeNull()
  })

  it('never turns a missing account cost into 100% margin', () => {
    const [, , groups] = buildDashboardWorkbook({
      startDate: '2026-11-02', endDate: '2026-11-08', unavailable: '数据不足',
      totals: { requests: 100, standard: 12, actual: 10, accountCost: 0, margin: null },
      trend: [], groups: [group(), group({ group_id: 8, group_name: 'No cost', account_cost: undefined })],
      models: [], labels,
    })
    const withCost = groups.rows[1]
    const noCost = groups.rows[2]
    expect(withCost[7]).toBe(4)
    expect(withCost[8]).toBe(40)
    expect(noCost[0]).toBe('No cost')
    expect(noCost[6]).toBe('数据不足')
    expect(noCost[7]).toBe('数据不足')
    expect(noCost[8]).toBe('数据不足')
  })

  it('keeps trend, group and model columns aligned with their headers', () => {
    const trend: TrendDataPoint[] = [{
      date: '2026-11-02', requests: 5, input_tokens: 1, output_tokens: 2,
      cache_creation_tokens: 3, cache_read_tokens: 4, total_tokens: 10, cost: 0.5, actual_cost: 0.4,
    }]
    const models: ModelStat[] = [{
      model: 'claude-opus', requests: 5, input_tokens: 1, output_tokens: 2,
      cache_creation_tokens: 3, cache_read_tokens: 4, total_tokens: 10, cost: 0.5, actual_cost: 0.4,
    }]
    const [, trendSheet, groupSheet, modelSheet] = buildDashboardWorkbook({
      startDate: '2026-11-02', endDate: '2026-11-08', unavailable: 'n/a',
      totals: { requests: 5, standard: 0.5, actual: 0.4, accountCost: 0, margin: null },
      trend, groups: [group()], models, labels,
    })
    for (const sheet of [trendSheet, groupSheet, modelSheet]) {
      expect(sheet.rows[0]).toHaveLength(sheet.rows[1].length)
    }
    expect(trendSheet.rows[1]).toEqual(['2026-11-02', 5, 1, 2, 4, 3, 10, 0.5, 0.4])
    expect(modelSheet.rows[1][0]).toBe('claude-opus')
  })
})
