import type { LocationQuery } from 'vue-router'
import { CONCRETE_PLATFORM_OPTIONS } from '@/constants/platforms'

/** An explicit monitor link overrides remembered filters without inventing an account ID. */
export function accountMonitorContext(query?: LocationQuery) {
  if (query?.source !== 'channel-monitor') return null
  const platform = typeof query.platform === 'string' && CONCRETE_PLATFORM_OPTIONS.some(option => option.value === query.platform) ? query.platform : ''
  const group = typeof query.group === 'string' && /^\d+$/.test(query.group) && Number.isSafeInteger(Number(query.group)) && Number(query.group) > 0 ? query.group : ''
  return { platform, group, status: '' }
}
