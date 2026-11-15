export type IQDetectionVerdict = 'normal' | 'warning' | 'degraded' | 'error'
export type IQDetectionEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type IQDetectionIntervalMinutes = 30 | 60 | 360 | 720 | 1440
export type IQDetectionTriggerType = 'manual' | 'scheduled'

export interface IQDetectionConfig {
  version: number
  enabled: boolean
  interval_minutes: IQDetectionIntervalMinutes
  group_ids: number[]
  model: string
  reasoning_effort: IQDetectionEffort
  tests_per_group: number
  last_scheduled_at: string | null
  updated_at: string
  updated_by: number | null
  builtin_prompt: string
}

export interface IQDetectionSample {
  run_index: number
  account_id?: number
  account_name?: string
  account_type?: string
  protocol?: string
  ok: boolean
  graded: boolean
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  latency_ms: number
  tps: number
  response_model: string
  answer_text: string
  error_message?: string
}

export interface IQDetectionRun {
  id: number
  group_id: number
  group_name: string
  platform: string
  trigger_type: IQDetectionTriggerType
  requested_model: string
  reasoning_effort: string
  tests_count: number
  graded_count: number
  correct_count: number
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
}

export interface IQDetectionRunNowInput {
  group_ids?: number[]
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
