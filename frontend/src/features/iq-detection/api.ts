import { apiClient } from '@/api/client'
import { adminAPI } from '@/api/admin'
import type { AdminGroup, PaginatedResponse } from '@/types'
import type {
  IQDetectionConfig,
  IQDetectionOverview,
  IQDetectionRun,
  IQDetectionRunBatchResult,
  IQDetectionRunListParams,
  IQDetectionRunNowInput
} from './types'

const RUN_NOW_TIMEOUT_MS = 900_000
const GROUP_CATALOG_PAGE_SIZE = 1000

export async function getIQDetectionConfig(signal?: AbortSignal): Promise<IQDetectionConfig> {
  const { data } = await apiClient.get<IQDetectionConfig>('/admin/iq-detection/config', {
    signal
  })
  return data
}

export async function updateIQDetectionConfig(
  payload: IQDetectionConfig
): Promise<IQDetectionConfig> {
  const { data } = await apiClient.put<IQDetectionConfig>('/admin/iq-detection/config', payload)
  return data
}

export async function getIQDetectionOverview(signal?: AbortSignal): Promise<IQDetectionOverview> {
  const { data } = await apiClient.get<IQDetectionOverview>('/admin/iq-detection/overview', {
    signal
  })
  return data
}

export async function listIQDetectionRuns(
  params: IQDetectionRunListParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<IQDetectionRun>> {
  const cleanParams: Record<string, unknown> = {
    page: params.page ?? 1,
    page_size: params.page_size ?? 20
  }
  if (params.group_id && params.group_id > 0) {
    cleanParams.group_id = params.group_id
  }
  if (params.verdict) {
    cleanParams.verdict = params.verdict
  }
  if (params.benchmark_type) {
    cleanParams.benchmark_type = params.benchmark_type
  }
  const { data } = await apiClient.get<PaginatedResponse<IQDetectionRun>>(
    '/admin/iq-detection/runs',
    {
      params: cleanParams,
      signal
    }
  )
  return data
}

export async function runIQDetectionNow(
  input: IQDetectionRunNowInput = {}
): Promise<IQDetectionRunBatchResult> {
  const { data } = await apiClient.post<IQDetectionRunBatchResult>(
    '/admin/iq-detection/run',
    input,
    {
      timeout: RUN_NOW_TIMEOUT_MS
    }
  )
  return data
}

/**
 * 分页拉取全部 OpenAI 平台分组（含未启用分组），遵循 .trellis/spec/frontend/groups-workspace.md 目录规范。
 */
export async function fetchAllOpenAIGroups(signal?: AbortSignal): Promise<AdminGroup[]> {
  const collected: AdminGroup[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    if (signal?.aborted) {
      break
    }
    const resp = await adminAPI.groups.list(
      page,
      GROUP_CATALOG_PAGE_SIZE,
      {
        platform: 'openai',
        sort_by: 'sort_order',
        sort_order: 'asc'
      },
      { signal }
    )
    if (Array.isArray(resp.items)) {
      collected.push(...resp.items)
    }
    totalPages = Math.max(1, resp.pages || 1)
    page += 1
  }

  return collected
}
