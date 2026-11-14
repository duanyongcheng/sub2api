const i18nT = (key: string, params?: Record<string, unknown>) => {
  const map: Record<string, string> = {
    'channelMonitorV2.matrix.title': '色块矩阵',
    'channelMonitorV2.matrix.description': '趋势色块视图',
    'channelMonitorV2.bucket.minutes': '{count}分钟',
    'channelMonitorV2.matrix.wheelZoomX': '滚轮缩放横向',
    'channelMonitorV2.matrix.resetZoom': '重置缩放',
    'channelMonitorV2.matrix.dimension': '维度',
    'channelMonitorV2.metrics.successRate': '成功率',
    'channelMonitorV2.metrics.ttft': '首 Token',
    'channelMonitorV2.metrics.tps': '每秒 Token',
    'channelMonitorV2.metrics.cacheRate': '缓存率',
    'channelMonitorV2.matrix.scoreLine': '评分 {score}',
    'channelMonitorV2.metrics.successRateValue': '成功率 {value}',
    'channelMonitorV2.metrics.errorRateValue': '错误率 {value}',
    'channelMonitorV2.metrics.rpmValue': 'RPM {value}',
    'channelMonitorV2.metrics.tpmValue': 'TPM {value}',
    'channelMonitorV2.metrics.tpsValue': '每秒 Token {value}',
    'channelMonitorV2.metrics.ttftValue': '首 Token {value}',
    'channelMonitorV2.metrics.durationValue': '时长 {value}',
    'channelMonitorV2.metrics.cacheRateValue': '缓存率 {value}',
    'channelMonitorV2.matrix.noTrafficAt': '{time} 无流量',
    'channelMonitorV2.matrix.noTraffic': '无流量',
    'channelMonitorV2.matrix.legendAria': '图例',
    'channelMonitorV2.matrix.bad': '差',
    'channelMonitorV2.matrix.good': '好',
    'channelMonitorV2.matrix.healthyLegend': '健康',
    'channelMonitorV2.matrix.warningLegend': '警告',
    'channelMonitorV2.matrix.criticalLegend': '异常',
    'channelMonitorV2.matrix.unknownLegend': '未知',
    'channelMonitorV2.matrix.backfill': '尚未覆盖（回填中）',
    'channelMonitorV2.matrix.backfillAt': '{time} · 尚未覆盖（回填中）',
    'channelMonitorV2.matrix.backfillHint': '系统还在补齐这段历史',
    'channelMonitorV2.matrix.backfillLegend': '尚未覆盖（回填中）',
  }
  const template = map[key] || key
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ''))
}

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: i18nT,
      te: (key: string) => key.startsWith('channelMonitorV2.'),
      locale: { value: 'zh' },
    }),
  }
})

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RelayPulseMatrix from '../RelayPulseMatrix.vue'
import type { MonitorHealth, MonitorMetric } from '@/api/channelMonitorV2'

const health: MonitorHealth = {
  overall: 'warning',
  error_rate: 'warning',
  ttft: 'healthy',
  cache: 'warning',
  score: 52,
  error_rate_score: 40,
  ttft_score: 100,
  cache_score: 50,
  minimum_sample: 20,
}

function metrics(requestCount: number): MonitorMetric {
  return {
    success_requests: requestCount ? requestCount - 1 : 0,
    error_requests: requestCount ? 1 : 0,
    request_count: requestCount,
    token_count: 100,
    rpm: 1.5,
    tpm: 10.2,
    error_rate: requestCount ? 1 / requestCount : 0,
    cache_rate: 0.5,
    cache_rate_numerator: 50,
    cache_rate_denominator: 100,
    ttft: { sample_count: requestCount, p50_ms: 100, p95_ms: 300, avg_ms: 150 },
    duration: { sample_count: requestCount, p50_ms: 500, p95_ms: 900, avg_ms: 600 },
    upstream_affected_requests: 2,
    upstream_attempt_count: 3,
  }
}

describe('RelayPulseMatrix', () => {
  it('shows privacy-safe hover tooltips and multi-band colors without click modal', async () => {
    const wrapper = mount(RelayPulseMatrix, {
      props: {
        rows: [{
          platform: 'openai',
          group_id: 7,
          group_name: '默认组',
          model: 'gpt-5',
          metrics: metrics(10),
          health,
          buckets: [
            { bucket_start: '2026-08-01T00:00:00Z', metrics: metrics(10), health },
            { bucket_start: '2026-08-01T00:01:00Z', metrics: metrics(0), health },
          ],
        }],
        coverage: {
          requested_start: '2026-08-01T00:00:00Z',
          requested_end: '2026-08-01T00:03:00Z',
          coverage_start: '2026-08-01T00:00:00Z',
          data_through: '2026-08-01T00:03:00Z',
          computed_at: '2026-08-01T00:03:00Z',
          aggregation_lag_seconds: 0,
          coverage_complete: true,
          bucket_seconds: 60,
        },
        healthMode: 'overall',
      },
    })

    const cells = wrapper.findAll('.pulse-cell')
    expect(cells).toHaveLength(3)
    // Hover tooltip content (privacy-safe: no absolute request/error counts)
    const tip = cells[0].text()
    expect(tip).toContain('成功率')
    expect(tip).toContain('90.0%')
    expect(tip).toContain('首 Token')
    expect(tip).toContain('每秒 Token')
    expect(tip).toContain('缓存率')
    expect(tip).toContain('RPM')
    expect(tip).not.toContain('请求数')
    expect(tip).not.toContain('用户错误')
    expect(tip).not.toContain('上游受影响')
    // Summary columns: success · ttft · tokens/s · cache
    const header = wrapper.find('.matrix-header').text()
    expect(header).toContain('成功率')
    expect(header).toContain('首 Token')
    expect(header).toContain('每秒 Token')
    expect(header).toContain('缓存率')
    // Multi-band class from score 52 → score5
    expect(cells[0].classes().some((c) => c.startsWith('health-score'))).toBe(true)
    // Redacted user payloads may have request_count=0 but still include score.
    expect(cells[1].classes().some((c) => c.startsWith('health-score'))).toBe(true)
    expect(cells[2].classes()).toContain('health-unknown')

    // No click-to-open modal
    await cells[0].trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})

describe('RelayPulseMatrix axis range', () => {
  it('uses selected requested range for the X axis even with partial coverage', () => {
    const wrapper = mount(RelayPulseMatrix, {
      props: {
        rows: [{
          platform: 'openai',
          group_id: 7,
          group_name: '默认组',
          model: 'gpt-5',
          metrics: metrics(10),
          health,
          buckets: [
            { bucket_start: '2026-08-01T00:02:00Z', metrics: metrics(10), health },
          ],
        }],
        coverage: {
          requested_start: '2026-08-01T00:00:00Z',
          requested_end: '2026-08-01T00:05:00Z',
          coverage_start: '2026-08-01T00:02:00Z',
          data_through: '2026-08-01T00:03:00Z',
          computed_at: '2026-08-01T00:03:00Z',
          aggregation_lag_seconds: 0,
          coverage_complete: false,
          bucket_seconds: 60,
        },
        healthMode: 'overall',
      },
    })
    // 5 minutes @ 60s buckets → 5 cells spanning the selected range
    expect(wrapper.findAll('.pulse-cell')).toHaveLength(5)
  })
})

describe('RelayPulseMatrix admin operations mode', () => {
  it('uses four availability states and emits the exact selected matrix interval', async () => {
    const normalMetrics = { ...metrics(10), error_rate: 0.005 }
    const selectedRow = {
      platform: 'openai',
      group_id: 7,
      group_name: '默认组',
      model: 'gpt-5',
      metrics: normalMetrics,
      health: { ...health, error_rate: 'healthy' as const, score: 42 },
      buckets: [{ bucket_start: '2026-08-01T00:00:00Z', metrics: normalMetrics, health: { ...health, error_rate: 'healthy' as const, score: 42 } }],
    }
    const wrapper = mount(RelayPulseMatrix, {
      props: {
        rows: [selectedRow],
        coverage: {
          requested_start: '2026-08-01T00:00:00Z', requested_end: '2026-08-01T00:01:00Z', coverage_start: '2026-08-01T00:00:00Z',
          data_through: '2026-08-01T00:01:00Z', computed_at: '2026-08-01T00:01:00Z', aggregation_lag_seconds: 0, coverage_complete: true, bucket_seconds: 60,
        },
        healthMode: 'overall',
        operations: true,
      },
    })

    const cell = wrapper.find('.pulse-cell')
    expect(cell.classes()).toContain('health-healthy')
    expect(cell.classes().some(name => name.startsWith('health-score'))).toBe(false)
    expect(wrapper.text()).toContain('channelMonitorV2.operations.requestCountValue')
    expect(wrapper.find('.matrix-header').text()).toContain('channelMonitorV2.operations.healthScore')
    expect(wrapper.find('.matrix-header').text()).not.toContain('每秒 Token')
    await cell.trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([selectedRow, '2026-08-01T00:00:00.000Z'])
  })
})

describe('RelayPulseMatrix boundary states', () => {
  const partial = {
    requested_start: '2026-08-01T00:00:00Z',
    requested_end: '2026-08-01T00:03:00Z',
    coverage_start: '2026-08-01T00:01:00Z',
    data_through: '2026-08-01T00:03:00Z',
    computed_at: '2026-08-01T00:03:00Z',
    aggregation_lag_seconds: 0,
    coverage_complete: false,
    bucket_seconds: 60,
  }

  it('separates slots still being backfilled from slots with no traffic', () => {
    const wrapper = mount(RelayPulseMatrix, {
      props: {
        rows: [{ platform: 'openai', group_id: 7, group_name: '默认组', model: 'gpt-5', metrics: metrics(10), health, buckets: [] }],
        coverage: partial,
        healthMode: 'overall',
      },
    })
    const cells = wrapper.findAll('.pulse-cell')
    expect(cells).toHaveLength(3)
    expect(cells[0].classes()).toContain('is-backfill')
    expect(cells[0].attributes('data-slot-state')).toBe('backfill')
    expect(cells[0].attributes('title')).toContain('尚未覆盖')
    expect(cells[0].text()).toContain('系统还在补齐这段历史')
    expect(cells[1].classes()).toContain('is-empty')
    expect(cells[1].attributes('data-slot-state')).toBe('no-traffic')
    expect(cells[1].attributes('title')).toContain('无流量')
    // Backfill is not a failure: it must not borrow a status color.
    expect(cells[0].classes()).toContain('health-unknown')
    expect(wrapper.find('[data-testid="matrix-backfill-legend"]').exists()).toBe(true)
  })

  it('hides the backfill legend once history is complete', () => {
    const wrapper = mount(RelayPulseMatrix, {
      props: {
        rows: [{ platform: 'openai', group_id: 7, group_name: '默认组', model: 'gpt-5', metrics: metrics(10), health, buckets: [] }],
        coverage: { ...partial, coverage_start: partial.requested_start, coverage_complete: true },
        healthMode: 'overall',
      },
    })
    expect(wrapper.findAll('.pulse-cell').every(cell => cell.attributes('data-slot-state') === 'no-traffic')).toBe(true)
    expect(wrapper.find('[data-testid="matrix-backfill-legend"]').exists()).toBe(false)
  })
})
