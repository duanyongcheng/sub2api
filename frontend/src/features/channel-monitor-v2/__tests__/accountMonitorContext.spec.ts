import { describe, expect, it } from 'vitest'
import { accountMonitorContext } from '../accountMonitorContext'

describe('account pool monitor deep link', () => {
  it('uses only validated platform and positive group filters for an explicit monitor link', () => {
    expect(accountMonitorContext({ source: 'channel-monitor', platform: 'openai', group: '27' })).toEqual({ platform: 'openai', group: '27', status: '' })
    expect(accountMonitorContext({ source: 'channel-monitor', platform: 'unknown', group: '-1' })).toEqual({ platform: '', group: '', status: '' })
  })

  it('leaves persisted account filters alone for ordinary navigation', () => {
    expect(accountMonitorContext({ platform: 'openai' })).toBeNull()
    expect(accountMonitorContext()).toBeNull()
  })
})
