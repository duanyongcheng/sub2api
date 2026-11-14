import { describe, expect, it } from 'vitest'
import type { AccountListItem } from '@/types'
import { accountPoolState } from '../accountPoolState'

describe('account pool state', () => {
  const now = Date.parse('2026-11-09T04:00:00Z')
  const account = { status: 'active', schedulable: true } as AccountListItem
  it('separates errors, paused accounts, and active cooldowns', () => {
    expect(accountPoolState(account, now)).toBe('available')
    expect(accountPoolState({ ...account, status: 'error', rate_limit_reset_at: '2026-11-10T00:00:00Z' }, now)).toBe('error')
    expect(accountPoolState({ ...account, schedulable: false }, now)).toBe('paused')
    expect(accountPoolState({ ...account, overload_until: '2026-11-09T04:05:00Z' }, now)).toBe('degraded')
    expect(accountPoolState({ ...account, rate_limit_reset_at: '2026-11-09T03:55:00Z' }, now)).toBe('available')
  })
  it('uses Unix seconds for expiration and checks model cooldowns', () => {
    expect(accountPoolState({ ...account, expires_at: now / 1000 - 1, auto_pause_on_expired: true }, now)).toBe('paused')
    expect(accountPoolState({ ...account, expires_at: now / 1000 + 60, auto_pause_on_expired: true }, now)).toBe('available')
    expect(accountPoolState({ ...account, extra: { model_rate_limits: { test: { rate_limited_at: '2026-11-09T04:00:00Z', rate_limit_reset_at: '2026-11-09T04:05:00Z' } } } }, now)).toBe('degraded')
  })
})
