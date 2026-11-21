import { computed, effectScope, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getIQDetectionVisibility } from './publicApi'

/**
 * Shared, session-scoped cache for the read-only IQ detection page switch.
 *
 * - Hidden until the server confirms `enabled: true` (the admin default is
 *   OFF, so an unknown state must never flash the sidebar entry in).
 * - Cached per signed-in user for CACHE_TTL_MS; signing out, signing in or
 *   switching accounts drops the cache so the next lookup refetches. Failed
 *   lookups stay hidden and retry on the next call.
 */
export const IQ_VISIBILITY_CACHE_TTL_MS = 5 * 60 * 1000

const enabled = ref(false)
const loadedForUser = ref<number | null>(null)
let loadedAt = 0
let pending: Promise<boolean> | null = null
let pendingUser: number | null = null
let generation = 0
let authWatcherStarted = false

function currentUserId(): number | null {
  let authStore: ReturnType<typeof useAuthStore>
  try {
    authStore = useAuthStore()
  } catch {
    // No active Pinia (isolated component tests): treat as signed out.
    return null
  }
  ensureAuthWatcher(authStore)
  if (!authStore.isAuthenticated) return null
  return authStore.user?.id ?? 0
}

function invalidate(): void {
  generation += 1
  enabled.value = false
  loadedForUser.value = null
  loadedAt = 0
  pending = null
  pendingUser = null
}

function ensureAuthWatcher(authStore: ReturnType<typeof useAuthStore>): void {
  if (authWatcherStarted) return
  authWatcherStarted = true
  effectScope(true).run(() => {
    watch(
      () => (authStore.isAuthenticated ? (authStore.user?.id ?? 0) : null),
      (next, prev) => {
        if (next === prev) return
        invalidate()
        if (next !== null) void refreshIQDetectionVisibility()
      }
    )
  })
}

export async function refreshIQDetectionVisibility(force = false): Promise<boolean> {
  const userId = currentUserId()
  if (userId === null) {
    invalidate()
    return false
  }
  const fresh = loadedForUser.value === userId && Date.now() - loadedAt < IQ_VISIBILITY_CACHE_TTL_MS
  if (!force && fresh) return enabled.value
  if (!force && pending && pendingUser === userId) return pending

  const token = ++generation
  pendingUser = userId
  const request = getIQDetectionVisibility()
    .then((res) => {
      if (token !== generation) return enabled.value
      enabled.value = res.enabled
      loadedForUser.value = userId
      loadedAt = Date.now()
      return res.enabled
    })
    .catch(() => {
      if (token !== generation) return enabled.value
      enabled.value = false
      loadedForUser.value = null
      loadedAt = 0
      return false
    })
    .finally(() => {
      if (token === generation) {
        pending = null
        pendingUser = null
      }
    })
  pending = request
  return request
}

/** Apply a value learned elsewhere (admin saved the switch, or a 403 NOT_PUBLIC). */
export function setIQDetectionVisibility(value: boolean): void {
  const userId = currentUserId()
  generation += 1
  pending = null
  pendingUser = null
  enabled.value = userId === null ? false : value
  loadedForUser.value = userId
  loadedAt = userId === null ? 0 : Date.now()
}

export function useIQDetectionVisibility() {
  return {
    iqDetectionPublic: computed(() => enabled.value),
    iqDetectionVisibilityLoaded: computed(() => loadedForUser.value !== null),
    refreshIQDetectionVisibility,
    setIQDetectionVisibility
  }
}

/** Test-only reset of the module cache. */
export function __resetIQDetectionVisibilityForTests(): void {
  invalidate()
}
