import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'
import { useAccountWorkspace, type AccountWorkspaceCapacity, type AccountWorkspaceUsage } from '../useAccountWorkspace'

const api = vi.hoisted(() => ({ groups: { getCapacitySummary: vi.fn(), getUsageSummary: vi.fn() } }))
vi.mock('@/api/admin', () => ({ adminAPI: api }))

const capacity = (used: number): AccountWorkspaceCapacity => ({
  group_id: 7, concurrency_used: used, concurrency_max: 12,
  sessions_used: 0, sessions_max: 0, rpm_used: 0, rpm_max: 0
})
const usage = (cost: number): AccountWorkspaceUsage => ({ group_id: 7, today_cost: cost, yesterday_cost: 0, total_cost: cost })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const scopes: EffectScope[] = []
const createWorkspace = (simple = false) => {
  const scope = effectScope()
  scopes.push(scope)
  const isSimpleMode = ref(simple)
  const workspace = scope.run(() => useAccountWorkspace({ isSimpleMode }))!
  return { ...workspace, isSimpleMode, scope }
}

beforeEach(() => {
  api.groups.getCapacitySummary.mockReset().mockResolvedValue([capacity(2)])
  api.groups.getUsageSummary.mockReset().mockResolvedValue([usage(4)])
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
})

describe('useAccountWorkspace', () => {
  it('keeps simple mode on basic data, including capability changes before a request starts', async () => {
    const workspace = createWorkspace(true)
    await workspace.refreshSummaries()
    expect(api.groups.getCapacitySummary).not.toHaveBeenCalled()
    expect(api.groups.getUsageSummary).not.toHaveBeenCalled()
    workspace.isSimpleMode.value = false
    const request = workspace.refreshSummaries()
    workspace.isSimpleMode.value = true
    await request
    expect(api.groups.getCapacitySummary).not.toHaveBeenCalled()
    expect(api.groups.getUsageSummary).not.toHaveBeenCalled()
    expect(workspace.summariesLoading.value).toBe(false)
  })

  it('exposes successful capacity while usage is still pending', async () => {
    const pendingUsage = deferred<AccountWorkspaceUsage[]>()
    api.groups.getUsageSummary.mockReturnValue(pendingUsage.promise)
    const workspace = createWorkspace()
    const request = workspace.refreshSummaries()
    await vi.waitFor(() => expect(workspace.capacityByGroup.value[7]).toEqual(capacity(2)))
    expect(workspace.summariesLoading.value).toBe(true)
    pendingUsage.resolve([usage(4)])
    await request
    expect(workspace.usageByGroup.value[7]).toEqual(usage(4))
    expect(workspace.summariesLoading.value).toBe(false)
  })

  it('retains last successful values with independent error flags, then recovers', async () => {
    const workspace = createWorkspace()
    await workspace.refreshSummaries()
    api.groups.getCapacitySummary.mockRejectedValueOnce(new Error('offline'))
    api.groups.getUsageSummary.mockResolvedValueOnce([usage(9)])
    await workspace.refreshSummaries()
    expect(workspace.capacityByGroup.value[7]).toEqual(capacity(2))
    expect(workspace.capacityError.value).toBe(true)
    expect(workspace.usageByGroup.value[7]).toEqual(usage(9))
    expect(workspace.usageError.value).toBe(false)
    api.groups.getUsageSummary.mockRejectedValueOnce(new Error('billing offline'))
    await workspace.refreshSummaries()
    expect(workspace.capacityError.value).toBe(false)
    expect(workspace.usageByGroup.value[7]).toEqual(usage(9))
    expect(workspace.usageError.value).toBe(true)
    await workspace.refreshSummaries()
    expect(workspace.usageError.value).toBe(false)
  })

  it('ignores older refreshes that finish after a newer response', async () => {
    const oldCapacity = deferred<AccountWorkspaceCapacity[]>()
    const oldUsage = deferred<AccountWorkspaceUsage[]>()
    api.groups.getCapacitySummary.mockReturnValueOnce(oldCapacity.promise)
    api.groups.getUsageSummary.mockReturnValueOnce(oldUsage.promise)
    const workspace = createWorkspace()
    const oldRequest = workspace.refreshSummaries()
    await Promise.resolve()
    await workspace.refreshSummaries()
    oldCapacity.resolve([capacity(11)])
    oldUsage.resolve([usage(99)])
    await oldRequest
    expect(workspace.capacityByGroup.value[7]).toEqual(capacity(2))
    expect(workspace.usageByGroup.value[7]).toEqual(usage(4))
    expect(workspace.summariesLoading.value).toBe(false)
  })

  it('does not publish responses after unmount or when simple mode becomes active', async () => {
    for (const stop of ['unmount', 'simple']) {
      const pending = deferred<AccountWorkspaceCapacity[]>()
      api.groups.getCapacitySummary.mockReturnValueOnce(pending.promise)
      const workspace = createWorkspace()
      const request = workspace.refreshSummaries()
      await Promise.resolve()
      if (stop === 'unmount') workspace.scope.stop()
      else workspace.isSimpleMode.value = true
      pending.resolve([capacity(8)])
      await request
      expect(workspace.capacityByGroup.value).toEqual({})
      expect(workspace.usageByGroup.value).toEqual({})
      expect(workspace.summariesLoading.value).toBe(false)
    }
  })

  it('degrades safely when a basic group API consumer omits advanced endpoints', async () => {
    const originalCapacity = api.groups.getCapacitySummary
    const originalUsage = api.groups.getUsageSummary
    Object.assign(api.groups, { getCapacitySummary: undefined, getUsageSummary: undefined })
    try {
      const workspace = createWorkspace()
      await expect(workspace.refreshSummaries()).resolves.toBeUndefined()
      expect(workspace.capacityError.value).toBe(true)
      expect(workspace.usageError.value).toBe(true)
      expect(workspace.capacityByGroup.value).toEqual({})
      expect(workspace.usageByGroup.value).toEqual({})
    } finally {
      Object.assign(api.groups, { getCapacitySummary: originalCapacity, getUsageSummary: originalUsage })
    }
  })
})
