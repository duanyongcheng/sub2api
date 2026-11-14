import { getCurrentScope, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { adminAPI } from '@/api/admin'

export type AccountWorkspaceCapacity = Awaited<ReturnType<typeof adminAPI.groups.getCapacitySummary>>[number]
export type AccountWorkspaceUsage = Awaited<ReturnType<typeof adminAPI.groups.getUsageSummary>>[number]

/** Batch summaries have their own lifecycle; the account list and group catalog stay with the page. */
export function useAccountWorkspace({ isSimpleMode }: { isSimpleMode: Readonly<Ref<boolean>> }) {
  const capacityByGroup = shallowRef<Record<number, AccountWorkspaceCapacity>>({})
  const usageByGroup = shallowRef<Record<number, AccountWorkspaceUsage>>({})
  const summariesLoading = ref(false)
  const capacityError = ref(false)
  const usageError = ref(false)
  let requestVersion = 0
  let disposed = false

  const refreshSummaries = async (): Promise<void> => {
    const version = ++requestVersion
    if (disposed || isSimpleMode.value) {
      summariesLoading.value = false
      return
    }

    summariesLoading.value = true
    const isCurrent = () => !disposed && !isSimpleMode.value && version === requestVersion

    // Resolve each result as it arrives, so a slow or failed endpoint cannot hide the other.
    // The guards also allow existing page consumers that provide only the basic group API.
    const capacityRequest = Promise.resolve().then(async () => {
      if (!isCurrent()) return []
      if (typeof adminAPI.groups.getCapacitySummary !== 'function') throw new Error('Capacity summary unavailable')
      return adminAPI.groups.getCapacitySummary()
    }).then((rows) => {
      if (!isCurrent()) return
      capacityByGroup.value = Object.fromEntries(rows.map((row) => [row.group_id, row]))
      capacityError.value = false
    }).catch(() => {
      if (isCurrent()) capacityError.value = true
    })

    const usageRequest = Promise.resolve().then(async () => {
      if (!isCurrent()) return []
      if (typeof adminAPI.groups.getUsageSummary !== 'function') throw new Error('Usage summary unavailable')
      return adminAPI.groups.getUsageSummary()
    }).then((rows) => {
      if (!isCurrent()) return
      usageByGroup.value = Object.fromEntries(rows.map((row) => [row.group_id, row]))
      usageError.value = false
    }).catch(() => {
      if (isCurrent()) usageError.value = true
    })

    await Promise.allSettled([capacityRequest, usageRequest])
    if (isCurrent()) summariesLoading.value = false
  }

  // Capability changes invalidate in-flight responses without starting any automatic requests.
  watch(isSimpleMode, (simple) => {
    if (!simple) return
    requestVersion++
    summariesLoading.value = false
    capacityByGroup.value = {}
    usageByGroup.value = {}
    capacityError.value = false
    usageError.value = false
  }, { flush: 'sync' })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true
      requestVersion++
      summariesLoading.value = false
    })
  }

  return { capacityByGroup, usageByGroup, summariesLoading, capacityError, usageError, refreshSummaries }
}
