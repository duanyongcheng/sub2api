import type { HealthState, MonitorHealth, MonitorMetric } from '@/api/channelMonitorV2'

/**
 * 「用户会看到什么」的纯前端推演。
 *
 * 设计主线要求管理员在**改配置之前**就知道客户会看到什么
 * （design-prototypes/docs/03-渠道监控设计方案.md §5.2 / §3.4）。
 * 这里只做算术：可用率 = 1 − 错误率，再用健康阈值换算出颜色档位，
 * 不新增接口，也不假装知道后端聚合细节（拿不到样本量时返回 unknown）。
 */

export interface PreviewInput {
  metrics: MonitorMetric
  /** Backend thresholds already embedded in the health payload win over the draft. */
  health?: MonitorHealth
  /** Draft thresholds from the settings panel, in ratio form (0.05 = 5%). */
  thresholds?: { warning_error_rate: number; critical_error_rate: number } | null
}

export interface AvailabilityPreview {
  /** 0–1 availability computed from the backend metrics. */
  availability: number
  /** Band the user would see for that availability. */
  state: HealthState
  errorRate: number
  /** The thresholds actually used, so the panel can state its basis. */
  warningErrorRate: number
  criticalErrorRate: number
}

export function previewAvailability({ metrics, health, thresholds }: PreviewInput): AvailabilityPreview | null {
  // Backend marks error_rate as unknown before the minimum sample is reached;
  // inventing a band there would contradict what users actually see.
  if (health?.error_rate === 'unknown') return null
  if (!Number.isFinite(metrics.error_rate) || metrics.request_count <= 0) return null

  // Without any thresholds there is no honest band to show.
  const warning = health?.thresholds?.warning_error_rate ?? thresholds?.warning_error_rate
  const critical = health?.thresholds?.critical_error_rate ?? thresholds?.critical_error_rate
  if (warning == null || critical == null) return null
  const errorRate = Math.max(0, Math.min(1, metrics.error_rate))
  return {
    availability: 1 - errorRate,
    state: errorRate >= critical ? 'critical' : errorRate >= warning ? 'warning' : 'healthy',
    errorRate,
    warningErrorRate: warning,
    criticalErrorRate: critical,
  }
}

/** Percentage string with the two decimals the availability cards use. */
export function formatPreviewRate(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}
