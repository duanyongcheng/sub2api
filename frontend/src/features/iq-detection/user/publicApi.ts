import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/types'
import { extractApiErrorCode } from '@/utils/apiError'
import type {
  IQDetectionPublicOverview,
  IQDetectionPublicRun,
  IQDetectionPublicRunListParams,
  IQDetectionVisibility
} from './publicTypes'

/** Reason code the backend returns (HTTP 403) while the admin keeps the page private. */
export const IQ_DETECTION_NOT_PUBLIC = 'IQ_DETECTION_NOT_PUBLIC'
export const PUBLIC_RUNS_MAX_PAGE_SIZE = 100

export async function getIQDetectionVisibility(signal?: AbortSignal): Promise<IQDetectionVisibility> {
  const { data } = await apiClient.get<IQDetectionVisibility>('/iq-detection/visibility', { signal })
  return { enabled: data?.enabled === true }
}

export async function getIQDetectionPublicOverview(
  signal?: AbortSignal
): Promise<IQDetectionPublicOverview> {
  const { data } = await apiClient.get<IQDetectionPublicOverview>('/iq-detection/overview', { signal })
  return data
}

export async function listIQDetectionPublicRuns(
  params: IQDetectionPublicRunListParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<IQDetectionPublicRun>> {
  const cleanParams: Record<string, unknown> = {
    page: params.page ?? 1,
    page_size: Math.min(Math.max(params.page_size ?? 20, 1), PUBLIC_RUNS_MAX_PAGE_SIZE)
  }
  if (params.group_id && params.group_id > 0) {
    cleanParams.group_id = params.group_id
  }
  if (params.benchmark_type) {
    cleanParams.benchmark_type = params.benchmark_type
  }
  const { data } = await apiClient.get<PaginatedResponse<IQDetectionPublicRun>>('/iq-detection/runs', {
    params: cleanParams,
    signal
  })
  return data
}

/** True when the request was rejected because the page is not public. */
export function isIQDetectionNotPublicError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { reason?: unknown; code?: unknown; error?: unknown }
  return (
    extractApiErrorCode(err) === IQ_DETECTION_NOT_PUBLIC ||
    e.code === IQ_DETECTION_NOT_PUBLIC ||
    e.error === IQ_DETECTION_NOT_PUBLIC
  )
}

export function isRequestCancelled(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; name?: unknown }
  return e.code === 'ERR_CANCELED' || e.name === 'CanceledError' || e.name === 'AbortError'
}
