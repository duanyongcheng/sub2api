import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({
  post: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  apiClient: { post },
}))

import { runNow, type RunNowResponse } from '@/api/admin/channelMonitor'

describe('admin channel monitor runNow API', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('posts without a body and allows the full synchronous check budget', async () => {
    post.mockResolvedValueOnce({ data: { results: [] } })

    await runNow(42)

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith(
      '/admin/channel-monitors/42/run',
      undefined,
      { timeout: 120000 }
    )
  })

  it('forwards unwrapped results without changing failed probes or quota snapshots', async () => {
    const response: RunNowResponse = {
      results: [{
        model: 'mock-model',
        status: 'failed',
        latency_ms: null,
        ping_latency_ms: 12,
        message: 'Mock upstream rejection',
        checked_at: '2026-11-13T12:00:00Z',
        quota: {
          source: 'usage',
          success: true,
          tiers: [{ window: '5h', used_percent: 25 }],
          fetched_at: '2026-11-13T12:00:01Z',
        },
      }],
    }
    post.mockResolvedValueOnce({ data: response })

    await expect(runNow(42)).resolves.toBe(response)
  })

  it('forwards API rejections unchanged without retrying', async () => {
    const error = { status: 0, code: 'ECONNABORTED', message: 'Mock timeout' }
    post.mockRejectedValueOnce(error)

    await expect(runNow(42)).rejects.toBe(error)
    expect(post).toHaveBeenCalledTimes(1)
  })
})
