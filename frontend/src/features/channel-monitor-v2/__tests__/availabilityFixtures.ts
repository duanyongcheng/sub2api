import type { HealthState, MonitorCoverage, MonitorHealth, MonitorMatrixRow, MonitorMetric } from '@/api/channelMonitorV2'

export const coverage: MonitorCoverage = {
  requested_start: '2026-10-01T00:00:00Z', requested_end: '2026-10-01T00:15:00Z',
  coverage_start: '2026-10-01T00:05:00Z', data_through: '2026-10-01T00:10:00Z',
  computed_at: '2026-10-01T00:10:00Z', aggregation_lag_seconds: 0, coverage_complete: false, bucket_seconds: 300,
}
export function health(state: HealthState = 'healthy'): MonitorHealth {
  return { overall: 'critical', error_rate: state, ttft: 'warning', cache: 'critical', minimum_sample: 50 }
}
export function metrics(errorRate = 0.01): MonitorMetric {
  return {
    success_requests: 0, error_requests: 0, request_count: 0, token_count: 0, rpm: 0, tpm: 0,
    error_rate: errorRate, cache_rate: 0, cache_rate_numerator: 0, cache_rate_denominator: 0,
    ttft: { sample_count: 0, p50_ms: 200, p95_ms: 400, avg_ms: 250 },
    duration: { sample_count: 0, p50_ms: 400, p95_ms: 500, avg_ms: 450 },
  }
}
export function row(overrides: Partial<MonitorMatrixRow> = {}): MonitorMatrixRow {
  return {
    platform: 'deepseek', group_id: 7, group_name: 'DeepSeek group', metrics: metrics(), health: health(),
    buckets: [{ bucket_start: '2026-10-01T00:05:00+00:00', metrics: metrics(), health: health() }],
    ...overrides,
  }
}
