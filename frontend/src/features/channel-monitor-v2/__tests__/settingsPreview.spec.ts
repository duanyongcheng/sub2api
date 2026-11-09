import { describe, expect, it } from 'vitest'
import type { MonitorHealth, MonitorMetric } from '@/api/channelMonitorV2'
import { formatPreviewRate, previewAvailability } from '../settingsPreview'

const base: MonitorMetric = {
  success_requests: 980, error_requests: 20, request_count: 1000,
  token_count: 0, rpm: 0, tpm: 0, error_rate: 0.02, cache_rate: 0,
  cache_rate_numerator: 0, cache_rate_denominator: 0,
  ttft: { sample_count: 1000, p50_ms: 100, p95_ms: 300, avg_ms: 150 },
  duration: { sample_count: 1000, p50_ms: 500, p95_ms: 900, avg_ms: 600 },
}

const health = (over: Partial<MonitorHealth> = {}): MonitorHealth => ({
  overall: 'healthy', error_rate: 'healthy', ttft: 'healthy',
  minimum_sample: 50, error_weight: 0.6, ttft_weight: 0.2,
  thresholds: { warning_error_rate: 0.05, critical_error_rate: 0.2, minimum_sample: 50, target_ttft_ms: 3000, warning_ttft_ms: 3000, critical_ttft_ms: 10000, error_weight: 0.6, ttft_weight: 0.2 },
  ...over,
})

describe('previewAvailability', () => {
  it('translates an error rate into the availability a user sees', () => {
    const result = previewAvailability({ metrics: base, health: health() })!
    expect(result.availability).toBeCloseTo(0.98)
    expect(result.state).toBe('healthy')
    expect(formatPreviewRate(result.availability)).toBe('98.00%')
    expect(formatPreviewRate(result.errorRate)).toBe('2.00%')
  })

  it('uses draft thresholds before saving so admins can see the change first', () => {
    const strict = previewAvailability({ metrics: base, thresholds: { warning_error_rate: 0.01, critical_error_rate: 0.5 } })!
    expect(strict.state).toBe('warning')
    expect(strict.warningErrorRate).toBe(0.01)
  })

  it('escalates to critical once the error rate crosses the critical band', () => {
    const result = previewAvailability({ metrics: { ...base, error_rate: 0.31 }, health: health() })!
    expect(result.state).toBe('critical')
    expect(result.availability).toBeCloseTo(0.69)
  })

  it('prefers backend thresholds over the draft when both exist', () => {
    const result = previewAvailability({
      metrics: base,
      health: health({ thresholds: { ...health().thresholds!, warning_error_rate: 0.001, critical_error_rate: 0.9 } }),
      thresholds: { warning_error_rate: 0.5, critical_error_rate: 0.8 },
    })!
    expect(result.warningErrorRate).toBe(0.001)
    expect(result.state).toBe('warning')
  })

  it('refuses to invent a verdict when evidence is insufficient', () => {
    expect(previewAvailability({ metrics: base, health: health({ error_rate: 'unknown' }) })).toBeNull()
    expect(previewAvailability({ metrics: { ...base, request_count: 0 }, health: health() })).toBeNull()
  })

  it('refuses to guess a band when no thresholds are known', () => {
    expect(previewAvailability({ metrics: base })).toBeNull()
    expect(previewAvailability({ metrics: base, health: health({ thresholds: undefined }) })).toBeNull()
  })
})
