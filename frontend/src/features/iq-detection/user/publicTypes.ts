import type { IQDetectionBenchmarkType, IQDetectionVerdict } from '../types'

/**
 * Read-only, end-user facing IQ detection contract (`/api/v1/iq-detection/*`).
 * The backend builds these from an explicit allow-list: no account identity,
 * error text, token counts, raw answers or response model ever reach users.
 */

export interface IQDetectionVisibility {
  enabled: boolean
}

export interface IQDetectionPublicArtifact {
  html: string
  score: number
  offline_compliant: boolean
}

export interface IQDetectionPublicRun {
  id: number
  group_id: number
  group_name: string
  benchmark_type: IQDetectionBenchmarkType | string
  requested_model: string
  reasoning_effort: string
  tests_count: number
  graded_count: number
  correct_count: number
  avg_score?: number | null
  verdict: IQDetectionVerdict
  avg_latency_ms: number
  avg_tps: number
  started_at: string
  completed_at: string
  /** Only populated for `pelican_svg`; always an array. */
  artifacts: IQDetectionPublicArtifact[]
}

export interface IQDetectionPublicGroup {
  group_id: number
  group_name: string
  platform: string
  /** Worst verdict across enabled benchmarks; null until the group has a run. */
  health: IQDetectionVerdict | null
  latest_runs_by_benchmark: Partial<Record<string, IQDetectionPublicRun>>
}

export interface IQDetectionPublicOverview {
  benchmark_types: string[]
  interval_minutes: number
  model: string
  reasoning_effort: string
  last_scheduled_at: string | null
  groups: IQDetectionPublicGroup[]
}

export interface IQDetectionPublicRunListParams {
  group_id?: number
  benchmark_type?: IQDetectionBenchmarkType
  page?: number
  page_size?: number
}
