import { describe, expect, it } from 'vitest'
import type { MonitorErrorRow } from '@/api/channelMonitorV2'
import { buildDrilldownWorkbook, type DrilldownReportLabels, type DrilldownReportInput } from '../monitorReport'
import { drilldownConclusion } from '../monitorDrilldown'
import { coverage, health, metrics } from './availabilityFixtures'

const labels: DrilldownReportLabels = {
  sheet: 'Recap', section: 'Section', item: 'Item', value: 'Value',
  category: 'Category', count: 'Count', share: 'Share', shareOfOwner: 'ShareOfOwner',
  owner: 'Owner', ignored: 'Ignored', yes: 'Yes', no: 'No',
  scope: 'Scope', window: 'Window', coverage: 'Coverage',
  coverageComplete: 'Complete', coveragePartial: 'Partial',
  dataThrough: 'Through', bucket: 'Bucket',
  availability: 'Availability', requests: 'Requests', errors: 'Errors',
  ttftP50: 'P50', ttftP95: 'P95', healthScore: 'Score',
  insufficient: 'Insufficient', conclusion: 'Conclusion', ignoredTotal: 'Ignored total',
  owners: { upstream: 'Upstream', account: 'Account pool', client: 'Client', internal: 'Internal', unclassified: 'Unclassified' },
}

function errorRow(category: string, count: number, ignored = false): MonitorErrorRow {
  return { category, count, rate: 0, ignored } as unknown as MonitorErrorRow
}

function build(overrides: Partial<DrilldownReportInput> = {}) {
  const errors = overrides.errors ?? [errorRow('rate_or_capacity', 74), errorRow('timeout', 16), errorRow('client_cancelled', 10, true)]
  const snapshot = overrides.snapshot ?? { coverage, metrics: { ...metrics(0.2), request_count: 500, error_requests: 100 }, health: health('critical') }
  return buildDrilldownWorkbook({
    label: 'Grok / grok-4.1-fast',
    start: '2026-10-01T00:00:00Z',
    end: '2026-10-01T00:05:00Z',
    snapshot,
    errors,
    conclusion: drilldownConclusion(errors, snapshot.metrics, snapshot.health),
    labels,
    ...overrides,
  })[0]
}

describe('channel monitor recap export', () => {
  it('states coverage and sample sufficiency so the file cannot be misread', () => {
    const sheet = build()
    // Scope rows carry the label in column 0; metric rows are prefixed by an empty section cell.
    const byItem = new Map(sheet.rows.map(row => [String(row[0] ? row[0] : row[1]), row[0] ? row[1] : row[2]]))
    expect(byItem.get('Coverage')).toBe('Partial')
    expect(byItem.get('Through')).toBe(coverage.data_through)
    expect(byItem.get('Conclusion')).toBe('Upstream · 100.0%')
    expect(byItem.get('Ignored total')).toBe(10)
  })

  it('writes insufficient data rather than 100% when samples are below the floor', () => {
    const only = [errorRow('authentication', 3)]
    const sheet = build({
      errors: only,
      snapshot: { coverage, metrics: { ...metrics(0.9), request_count: 3, error_requests: 3 }, health: health('unknown') },
    })
    const byItem = new Map(sheet.rows.filter(row => row[1]).map(row => [String(row[1]), row[2]]))
    expect(byItem.get('Conclusion')).toBe('Insufficient')
    expect(byItem.get('Score')).toBe('Insufficient')
    expect(String(byItem.get('Availability'))).not.toContain('100')
  })

  it('lists every category with share of all errors, owner and ignored flag', () => {
    const sheet = build()
    const headerIndex = sheet.rows.findIndex(row => row[0] === 'Section' && row[1] === 'Category')
    const header = sheet.rows[headerIndex]
    expect(header).toEqual(['Section', 'Category', 'Count', 'Share', 'Owner', 'ShareOfOwner', 'Ignored'])
    const rows = sheet.rows.slice(headerIndex + 1)
    expect(rows).toHaveLength(3)
    // Sorted by count, biggest first.
    expect(rows[0][1]).toBe('rate_or_capacity')
    expect(rows[0][2]).toBe(74)
    expect(rows[0][3]).toBeCloseTo(0.74)
    expect(rows[0][4]).toBe('Upstream')
    // Share of owner keeps the two denominators distinguishable.
    expect(rows[0][5]).toBeCloseTo(0.74 / 0.9)
    const ignored = rows.find(row => row[1] === 'client_cancelled')
    expect(ignored?.[6]).toBe('Yes')
    expect(rows.every(row => row.length === header.length)).toBe(true)
  })
})
