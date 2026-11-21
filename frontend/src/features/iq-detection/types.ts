export type IQDetectionVerdict = 'normal' | 'warning' | 'degraded' | 'error'
export type IQDetectionEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type IQDetectionIntervalMinutes = 30 | 60 | 360 | 720 | 1440
export type IQDetectionTriggerType = 'manual' | 'scheduled'
export type IQDetectionBenchmarkType = 'candy_logic' | 'pelican_svg'

export interface IQDetectionPelicanEval {
  score: number
  has_complete_html: boolean
  has_svg: boolean
  has_view_box: boolean
  offline_compliant: boolean
  primitive_count: number
  path_count: number
  curve_command_count: number
  group_count: number
  unique_color_count: number
  has_animation: boolean
  animation_driver_count: number
  wheel_pair_detected: boolean
  semantic_parts_detected: string[]
  issues?: string[]
}

export interface IQDetectionConfig {
  version: number
  enabled: boolean
  interval_minutes: IQDetectionIntervalMinutes
  benchmark_type?: IQDetectionBenchmarkType
  benchmark_types?: IQDetectionBenchmarkType[]
  group_ids: number[]
  model: string
  reasoning_effort: IQDetectionEffort
  tests_per_group: number
  /** When true, signed-in users can open the read-only /iq-detection page. Defaults to false. */
  user_visible?: boolean
  last_scheduled_at: string | null
  updated_at: string
  updated_by: number | null
  builtin_prompt: string
  builtin_prompts?: Record<string, string>
}

export interface IQDetectionSample {
  run_index: number
  account_id?: number
  account_name?: string
  account_type?: string
  protocol?: string
  ok: boolean
  graded: boolean
  score?: number
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  latency_ms: number
  tps: number
  response_model: string
  answer_text: string
  artifact_html?: string
  pelican_eval?: IQDetectionPelicanEval
  error_message?: string
}

export interface IQDetectionRun {
  id: number
  group_id: number
  group_name: string
  platform: string
  trigger_type: IQDetectionTriggerType
  benchmark_type?: IQDetectionBenchmarkType
  requested_model: string
  reasoning_effort: string
  tests_count: number
  graded_count: number
  correct_count: number
  avg_score?: number
  verdict: IQDetectionVerdict
  avg_input_tokens: number
  avg_output_tokens: number
  avg_reasoning_tokens: number
  avg_latency_ms: number
  avg_tps: number
  response_model: string
  answer_preview: string
  error_message: string
  samples: IQDetectionSample[]
  started_at: string
  completed_at: string
  created_at: string
}

export interface IQDetectionGroupStatus {
  group_id: number
  group_name: string
  platform: string
  group_status: 'active' | 'inactive' | 'missing' | string
  schedulable_account_count: number
  in_flight: boolean
  latest_run: IQDetectionRun | null
  latest_runs_by_benchmark?: Partial<Record<IQDetectionBenchmarkType, IQDetectionRun>>
}

export interface IQDetectionOverviewSummary {
  configured_count: number
  tested_count: number
  normal_count: number
  warning_count: number
  degraded_count: number
  error_count: number
  untested_count: number
}

export interface IQDetectionOverview {
  config: IQDetectionConfig
  summary: IQDetectionOverviewSummary
  groups: IQDetectionGroupStatus[]
}

export interface IQDetectionRunListParams {
  page?: number
  page_size?: number
  group_id?: number
  verdict?: IQDetectionVerdict | ''
  benchmark_type?: IQDetectionBenchmarkType | ''
}

export interface IQDetectionRunNowInput {
  group_ids?: number[]
  benchmark_type?: IQDetectionBenchmarkType
  benchmark_types?: IQDetectionBenchmarkType[]
  model?: string
  reasoning_effort?: IQDetectionEffort
  tests_per_group?: number
}

export interface IQDetectionRunBatchResult {
  requested_groups: number
  executed_groups: number
  skipped_in_flight_groups: number[]
  runs: IQDetectionRun[]
}
