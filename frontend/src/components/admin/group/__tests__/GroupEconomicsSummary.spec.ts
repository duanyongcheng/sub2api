import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { getGroupStats } from '@/api/admin/dashboard'
import GroupEconomicsSummary from '../GroupEconomicsSummary.vue'
import type { AdminGroup } from '@/types'

vi.mock('@/api/admin/dashboard', () => ({ getGroupStats: vi.fn() }))
vi.mock('vue-i18n', async importOriginal => ({ ...await importOriginal<typeof import('vue-i18n')>(), useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => params ? `${key}:${JSON.stringify(params)}` : key }) }))
describe('group economics summary', () => {
  const group = { id: 1, rate_multiplier: 1, account_count: 2, active_account_count: 1 } as AdminGroup
  beforeEach(() => vi.mocked(getGroupStats).mockReset())
  it('keeps missing costs unknown instead of reporting a 100 percent margin', async () => {
    vi.mocked(getGroupStats).mockResolvedValue({ groups: [{ group_id: 1, actual_cost: 10 }], start_date: '', end_date: '' } as never)
    const wrapper = mount(GroupEconomicsSummary, { props: { group, draftRate: 1 } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('100.0%')
    expect(wrapper.text()).toContain('$10.00')
    expect(wrapper.text()).toContain('—')
    wrapper.unmount()
  })
  it('reports negative historical margin and labels the multiplier estimate separately', async () => {
    vi.mocked(getGroupStats).mockResolvedValue({ groups: [{ group_id: 1, actual_cost: 10, account_cost: 12 }], start_date: '', end_date: '' } as never)
    const wrapper = mount(GroupEconomicsSummary, { props: { group, draftRate: 2 } })
    await flushPromises()
    expect(wrapper.text()).toContain('-20.0%')
    expect(wrapper.get('[role="status"]').text()).toContain('lossWarning')
    expect(wrapper.text()).toContain('projectedMargin:{"margin":"40.0"}')
    wrapper.unmount()
  })
})
