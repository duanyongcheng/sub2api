import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../client'
import { getMatrix, getSnapshot, repeatedArrayParamsSerializer } from '../channelMonitorV2'

afterEach(() => vi.restoreAllMocks())

describe('channel monitor V2 query serialization', () => {
  it('uses repeated keys without bracket suffixes for array filters', () => {
    const query = repeatedArrayParamsSerializer({
      range: '90m',
      platform: ['openai', 'grok'],
      group_id: [1, 2],
      model: undefined,
      group_by: 'platform_group_model',
    })

    expect(query).toBe('range=90m&platform=openai&platform=grok&group_id=1&group_id=2&group_by=platform_group_model')
    expect(query).not.toContain('%5B%5D')
  })

  it('sends the matrix grouping with the shared filters', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { coverage: {}, group_by: 'platform_group', items: [] },
    })

    await getMatrix({ range: '24h', platforms: ['openai'], groupIds: [7], models: [] }, 'platform_group', true)

    expect(get).toHaveBeenCalledWith('/admin/channel-monitor-v2/matrix', expect.objectContaining({
      params: {
        range: '24h',
        platform: ['openai'],
        group_id: [7],
        model: undefined,
        group_by: 'platform_group',
      },
    }))
  })

  it('sends an optional fixed admin interval without changing ordinary range queries', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {} })
    const filter = {
      range: '24h' as const, platforms: ['openai'], groupIds: [7], models: ['gpt-5'],
      start: '2026-11-08T13:00:00.000Z', end: '2026-11-08T14:00:00.000Z',
    }

    await getSnapshot(filter, true)

    expect(get).toHaveBeenCalledWith('/admin/channel-monitor-v2/snapshot', expect.objectContaining({
      params: {
        range: '24h', platform: ['openai'], group_id: [7], model: ['gpt-5'],
        start: '2026-11-08T13:00:00.000Z', end: '2026-11-08T14:00:00.000Z',
      },
    }))
  })
})
