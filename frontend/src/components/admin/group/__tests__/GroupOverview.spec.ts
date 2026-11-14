import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GroupOverview from '../GroupOverview.vue'
import type { AdminGroup } from '@/types'

vi.mock('vue-i18n', async importOriginal => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key })
}))

const group = (overrides: Partial<AdminGroup> = {}): AdminGroup => ({
  id: 1,
  name: 'Claude Pro',
  description: 'Subscription pool for Claude models.',
  platform: 'anthropic',
  rate_multiplier: 0.8,
  status: 'active',
  subscription_type: 'subscription',
  account_count: 86,
  active_account_count: 78,
  is_exclusive: true,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
} as AdminGroup)

const mountOverview = (props: Partial<{ group: AdminGroup; draftRate: number; simple: boolean; duplicating: boolean }> = {}) => mount(GroupOverview, {
  props: { group: group(), draftRate: 0.8, simple: false, duplicating: false, ...props },
  global: { stubs: { GroupEconomicsSummary: true } }
})

describe('GroupOverview', () => {
  it('presents identity, status and description without duplicating the editor title', () => {
    const wrapper = mountOverview()
    expect(wrapper.text()).toContain('Claude Pro')
    expect(wrapper.text()).toContain('Subscription pool for Claude models.')
    expect(wrapper.text()).toContain('admin.groups.subscription.subscription')
    expect(wrapper.text()).toContain('admin.groups.exclusive')
    expect(wrapper.text()).toContain('×0.8')
    wrapper.unmount()
  })

  it('emits each group action', async () => {
    const wrapper = mountOverview()
    await wrapper.get('[data-testid="group-duplicate"]').trigger('click')
    await wrapper.get('[data-testid="group-rate-multipliers"]').trigger('click')
    await wrapper.get('[data-testid="group-rpm-overrides"]').trigger('click')
    await wrapper.get('[data-testid="group-delete"]').trigger('click')
    expect(wrapper.emitted('duplicate')).toHaveLength(1)
    expect(wrapper.emitted('rates')).toHaveLength(1)
    expect(wrapper.emitted('rpm')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
    wrapper.unmount()
  })

  it('hides advanced actions in simple mode', () => {
    const wrapper = mountOverview({ simple: true })
    expect(wrapper.find('[data-testid="group-duplicate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-rate-multipliers"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-rpm-overrides"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-delete"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows a quiet fallback when the group has no description', () => {
    const wrapper = mountOverview({ group: group({ description: null }) })
    expect(wrapper.text()).toContain('admin.groups.workspace.noDescription')
    wrapper.unmount()
  })
})
