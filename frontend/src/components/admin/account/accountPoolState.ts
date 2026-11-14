import type { AccountListItem } from '@/types'

export type AccountPoolState = 'available' | 'degraded' | 'error' | 'paused'

export function accountPoolState(account: AccountListItem, now = Date.now()): AccountPoolState {
  if (account.status === 'error') return 'error'
  if (account.status !== 'active') return 'paused'
  const future = (value: string | null | undefined) => Boolean(value && new Date(value).getTime() > now)
  if (
    future(account.rate_limit_reset_at) || future(account.overload_until) ||
    future(account.temp_unschedulable_until) ||
    Object.values(account.extra?.model_rate_limits ?? {}).some(limit => future(limit.rate_limit_reset_at))
  ) return 'degraded'
  if (!account.schedulable || (account.auto_pause_on_expired && account.expires_at && account.expires_at * 1000 <= now)) return 'paused'
  return 'available'
}
