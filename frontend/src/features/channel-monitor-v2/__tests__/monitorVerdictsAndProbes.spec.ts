import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { MonitorErrorRow, MonitorHealth, MonitorMetric } from '@/api/channelMonitorV2'
import MonitorAttributionPanel from '../MonitorAttributionPanel.vue'
import MonitorProbePanel from '../MonitorProbePanel.vue'
import type { ChannelMonitor } from '@/api/admin/channelMonitor'

vi.mock('vue-i18n', () => ({
  createI18n: () => ({}),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
    te: () => true,
    locale: { value: 'en' },
  }),
}))

const metrics: MonitorMetric = {
  success_requests: 900, error_requests: 100, request_count: 1000,
  token_count: 0, rpm: 0, tpm: 0, error_rate: 0.1, cache_rate: 0,
  cache_rate_numerator: 0, cache_rate_denominator: 0,
  ttft: { sample_count: 1000, p50_ms: 100, p95_ms: 300, avg_ms: 150 },
  duration: { sample_count: 1000, p50_ms: 500, p95_ms: 900, avg_ms: 600 },
}
const health: MonitorHealth = {
  overall: 'warning', error_rate: 'warning', ttft: 'healthy',
  minimum_sample: 50, error_weight: 0.6, ttft_weight: 0.2,
  thresholds: { warning_error_rate: 0.05, critical_error_rate: 0.2, minimum_sample: 50, target_ttft_ms: 3000, warning_ttft_ms: 3000, critical_ttft_ms: 10000, error_weight: 0.6, ttft_weight: 0.2 },
}
const row = (category: string, count: number): MonitorErrorRow => ({
  category, count, ignored: false,
} as MonitorErrorRow)

describe('MonitorAttributionPanel verdicts', () => {
  it('gives every responsibility with errors a concrete next action', () => {
    const wrapper = mount(MonitorAttributionPanel, {
      props: { rows: [row('authentication', 30), row('rate_or_capacity', 70)], metrics, health },
    })
    // Each owner card carries the 占比 → 结论 → 动作 chain from the design doc.
    expect(wrapper.find('[data-action="account"]').text()).toContain('channelMonitorV2.operations.verdictAction.account')
    expect(wrapper.find('[data-action="upstream"]').text()).toContain('channelMonitorV2.operations.verdictAction.upstream')
    // Owners without errors stay silent: no invented instruction.
    expect(wrapper.find('[data-action="client"]').exists()).toBe(false)
    expect(wrapper.find('[data-action="internal"]').exists()).toBe(false)
  })
})

describe('MonitorProbePanel binding state', () => {
  const probe = (over: Partial<ChannelMonitor> = {}): ChannelMonitor => ({
    id: 1, name: 'deepseek-direct', provider: 'deepseek', api_mode: 'chat_completions',
    endpoint: 'https://api.deepseek.com', api_key_masked: 'sk-***', primary_model: 'deepseek-chat',
    extra_models: [], group_name: '', enabled: true, interval_seconds: 300, jitter_seconds: 0,
    last_checked_at: null, created_by: 1, created_at: '', updated_at: '',
    primary_status: '', primary_latency_ms: null, availability_7d: 0, extra_models_status: [],
    template_id: null, extra_headers: {}, body_override_mode: 'off', body_override: null,
    check_mode: 'probe', account_id: null,
    ...over,
  } as ChannelMonitor)

  it('marks probes that cannot drive a group verdict as unbound', () => {
    const wrapper = mount(MonitorProbePanel, { props: { items: [probe()], total: 1 } })
    expect(wrapper.text()).toContain('channelMonitorV2.operations.probeUnbound')
    // The marker must be the low-weight dashed pill, never a status tone.
    expect(wrapper.find('.pill-muted').exists()).toBe(true)
  })

  it('drops the marker once the backend exposes a group binding', () => {
    const wrapper = mount(MonitorProbePanel, {
      props: { items: [probe({ group_id: 12 } as Partial<ChannelMonitor>)], total: 1 },
    })
    expect(wrapper.text()).not.toContain('channelMonitorV2.operations.probeUnbound')
  })
})
