import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AccountPoolNavigator from '../AccountPoolNavigator.vue'
import AccountPoolOverview from '../AccountPoolOverview.vue'
import messages from '@/i18n/locales/en/admin/accounts'
import { CONCRETE_PLATFORM_OPTIONS } from '@/constants/platforms'
import type { AccountListItem, AdminGroup } from '@/types'
import type { AccountWorkspaceCapacity } from '@/composables/useAccountWorkspace'

const groups = [
  { id: 7, name: 'Production', platform: 'anthropic', account_count: 12, active_account_count: 9, rate_limited_account_count: 2 },
  { id: 8, name: 'Shared fallback', platform: 'composite', account_count: 12 }
] as AdminGroup[]
const capacity: AccountWorkspaceCapacity = {
  group_id: 7, concurrency_used: 4, concurrency_max: 20,
  sessions_used: 0, sessions_max: 0, rpm_used: 2, rpm_max: 30
}
// The app and Vitest use the runtime-only i18n build. Supply message functions,
// as the production Vite plugin does, so these tests exercise the actual copy.
const workspaceMessages = Object.fromEntries(Object.entries(messages.accounts.workspace).map(([key, value]) => [
  key,
  (context: { named: (name: string) => unknown }) => value.replace(/\{(\w+)\}/g, (_match, name: string) => String(context.named(name)))
]))
const global = () => ({
  plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: { admin: { accounts: { workspace: workspaceMessages } }, common: { loading: () => 'Loading…', details: () => 'Details' } } } })],
  stubs: { RouterLink: { template: '<a><slot /></a>' } }
})
const navigatorProps = () => ({
  groups, group: '', platform: '', capacities: { 7: capacity }, loading: false, capacityError: false, simple: false
})
const overviewProps = () => ({
  ...navigatorProps(),
  accounts: [{ id: 1, status: 'active', schedulable: true, concurrency: 8, current_concurrency: 2 }] as AccountListItem[],
  total: 90,
  usage: { 7: { group_id: 7, today_cost: 12.5, yesterday_cost: 5, total_cost: 50 } },
  summariesLoading: false,
  usageError: false
})

describe('AccountPoolNavigator', () => {
  it('emits server filter scopes for pools, platforms, all accounts and ungrouped accounts', async () => {
    const wrapper = mount(AccountPoolNavigator, { props: navigatorProps(), global: global() })
    await wrapper.get('[data-pool="7"]').trigger('click')
    await wrapper.get('[data-platform="anthropic"]').trigger('click')
    await wrapper.get('[data-pool="8"]').trigger('click')
    await wrapper.get('[data-pool="ungrouped"]').trigger('click')
    await wrapper.get('[data-pool="all"]').trigger('click')
    expect(wrapper.emitted('navigate')).toEqual([
      [{ group: '7', platform: '' }],
      [{ group: '', platform: 'anthropic' }],
      [{ group: '8', platform: '' }],
      [{ group: 'ungrouped', platform: '' }],
      [{ group: '', platform: '' }]
    ])
    expect(wrapper.find('[data-platform="composite"]').exists()).toBe(false)
    expect(wrapper.get('[data-pool="all"]').text()).toBe('All accounts')
  })

  it('filters pool names locally, keeps reset controls available and closes the mobile disclosure', async () => {
    const wrapper = mount(AccountPoolNavigator, { props: navigatorProps(), global: global() })
    const disclosure = wrapper.get('button[aria-expanded]')
    await disclosure.trigger('click')
    expect(disclosure.attributes('aria-expanded')).toBe('true')
    await wrapper.get('input[type="search"]').setValue('production')
    expect(wrapper.find('[data-pool="8"]').exists()).toBe(false)
    expect(wrapper.find('[data-pool="all"]').exists()).toBe(true)
    await wrapper.get('[data-pool="7"]').trigger('click')
    expect(disclosure.attributes('aria-expanded')).toBe('false')
    await wrapper.get('input[type="search"]').setValue('missing')
    expect(wrapper.text()).toContain('No pools match this search')
  })

  it('keeps every concrete platform available with an empty catalog and after catalog loss', async () => {
    const wrapper = mount(AccountPoolNavigator, { props: { ...navigatorProps(), groups: [] }, global: global() })
    const platformValues = CONCRETE_PLATFORM_OPTIONS.map(option => option.value)
    expect(wrapper.findAll('[data-platform]').map(button => button.attributes('data-platform'))).toEqual(platformValues)
    expect(wrapper.find('[data-platform="composite"]').exists()).toBe(false)
    for (const platform of platformValues) {
      await wrapper.get(`[data-platform="${platform}"]`).trigger('click')
    }
    expect(wrapper.emitted('navigate')).toEqual(platformValues.map(platform => [{ group: '', platform }]))
    await wrapper.setProps({ loading: true })
    expect(wrapper.findAll('[data-platform]')).toHaveLength(platformValues.length)
    await wrapper.setProps({ groups, loading: false })
    expect(wrapper.find('[data-pool="7"]').exists()).toBe(true)
    // A failed catalog reload may leave no groups; account filtering stays usable.
    await wrapper.setProps({ groups: [], capacityError: true })
    expect(wrapper.findAll('[data-platform]').map(button => button.attributes('data-platform'))).toEqual(platformValues)
    await wrapper.get('[data-platform="openai"]').trigger('click')
    expect(wrapper.emitted('navigate')?.at(-1)).toEqual([{ group: '', platform: 'openai' }])
    expect(wrapper.find('ul').exists()).toBe(false)
  })

  it('retains catalog ordering within pools and shows only matching sections during search', async () => {
    const wrapper = mount(AccountPoolNavigator, {
      props: { ...navigatorProps(), groups: [groups[0], { ...groups[0], id: 2, name: 'Production backup' }, groups[1]] },
      global: global()
    })
    expect(wrapper.get('[data-platform="anthropic"]').element.closest('section')?.querySelectorAll('[data-pool]')).toHaveLength(2)
    expect(wrapper.findAll('ul [data-pool]').map(button => button.attributes('data-pool'))).toEqual(['7', '2', '8'])
    await wrapper.get('input[type="search"]').setValue('production')
    expect(wrapper.findAll('[data-platform]').map(button => button.attributes('data-platform'))).toEqual(['anthropic'])
    expect(wrapper.findAll('section')).toHaveLength(1)
    await wrapper.get('input[type="search"]').setValue('shared')
    expect(wrapper.findAll('section')).toHaveLength(1)
    expect(wrapper.find('[data-platform="composite"]').exists()).toBe(false)
    expect(wrapper.find('[data-pool="8"]').exists()).toBe(true)
    await wrapper.get('input[type="search"]').setValue('')
    expect(wrapper.findAll('[data-platform]')).toHaveLength(CONCRETE_PLATFORM_OPTIONS.length)
  })

  it('shows missing counts and failed capacity as unknown and omits advanced values in simple mode', async () => {
    const wrapper = mount(AccountPoolNavigator, { props: { ...navigatorProps(), capacityError: true }, global: global() })
    expect(wrapper.get('[data-pool="7"]').text()).toContain('—')
    expect(wrapper.get('[data-pool="7"]').text()).not.toContain('4 / 20')
    await wrapper.setProps({ simple: true })
    expect(wrapper.get('[data-pool="7"]').text()).not.toContain('Concurrency')
    expect(wrapper.get('[data-pool="7"]').text()).toContain('12')
  })

  it('shows pool load as a ring, a bare track when idle and keeps exact concurrency accessible', async () => {
    const wrapper = mount(AccountPoolNavigator, { props: navigatorProps(), global: global() })
    expect(wrapper.get('[data-pool="7"]').text()).toContain('Concurrency in use: 4 / 20')
    const arc = wrapper.findAll('[data-pool="7"] .pool-gauge circle')
    expect(arc).toHaveLength(2)
    expect(Number.parseFloat(arc[1].attributes('stroke-dasharray') ?? '')).toBeCloseTo(0.2 * 2 * Math.PI * 6, 2)
    expect(wrapper.get('[data-pool="7"]').attributes('title')).toContain('4 / 20')
    await wrapper.setProps({ capacities: { 7: { ...capacity, concurrency_used: 0 } } })
    expect(wrapper.findAll('[data-pool="7"] .pool-gauge circle')).toHaveLength(1)
    expect(wrapper.get('[data-pool="7"]').text()).toContain('Concurrency in use: 0 / 20')
    await wrapper.setProps({ capacities: { 7: capacity }, simple: true })
    expect(wrapper.find('[data-pool="7"] .pool-gauge svg').exists()).toBe(false)
    expect(wrapper.get('[data-pool="7"]').attributes('title')).not.toContain('Concurrency')
  })

  it('folds platform sections, remembers them and reveals searched or selected pools', async () => {
    const storageKey = 'account-pool-collapsed-platforms'
    localStorage.removeItem(storageKey)
    const wrapper = mount(AccountPoolNavigator, { props: navigatorProps(), global: global() })
    const toggle = () => wrapper.get('[data-platform-toggle="anthropic"]')
    expect(toggle().attributes('aria-expanded')).toBe('true')
    await toggle().trigger('click')
    expect(toggle().attributes('aria-expanded')).toBe('false')
    expect(toggle().text()).toBe('1')
    expect(wrapper.find('[data-pool="7"]').exists()).toBe(false)
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toEqual(['anthropic'])
    // Folding never changes the server filter; the platform label still does.
    expect(wrapper.emitted('navigate')).toBeUndefined()
    await wrapper.get('[data-platform="anthropic"]').trigger('click')
    expect(wrapper.emitted('navigate')?.at(-1)).toEqual([{ group: '', platform: 'anthropic' }])
    wrapper.unmount()

    const remounted = mount(AccountPoolNavigator, { props: navigatorProps(), global: global() })
    expect(remounted.find('[data-pool="7"]').exists()).toBe(false)
    await remounted.get('input[type="search"]').setValue('prod')
    expect(remounted.find('[data-pool="7"]').exists()).toBe(true)
    expect(remounted.find('[data-platform-toggle]').exists()).toBe(false)
    await remounted.get('input[type="search"]').setValue('')
    expect(remounted.find('[data-pool="7"]').exists()).toBe(false)
    await remounted.setProps({ group: '7' })
    expect(remounted.get('[data-pool="7"]').attributes('aria-current')).toBe('true')

    await remounted.get('[data-pool-toggle="all"]').trigger('click')
    expect(remounted.findAll('ul [data-pool]')).toHaveLength(0)
    expect(remounted.get('[data-pool-toggle="all"]').text()).toBe('Expand all')
    await remounted.get('[data-pool-toggle="all"]').trigger('click')
    expect(remounted.findAll('ul [data-pool]').map(button => button.attributes('data-pool'))).toEqual(['7', '8'])
    remounted.unmount()
    localStorage.removeItem(storageKey)
  })
})

describe('AccountPoolOverview', () => {
  it('uses page health for broad scopes and keeps matching server count separate', () => {
    const wrapper = mount(AccountPoolOverview, { props: overviewProps(), global: global() })
    expect(wrapper.text()).toContain('Current page · 1 accounts')
    expect(wrapper.text()).toContain('90')
    expect(wrapper.text()).toContain('2 / 8')
    expect(wrapper.text()).not.toContain('24')
    expect(wrapper.text()).not.toContain('Customer deductions today')
  })

  it('updates page health from the supplied clock without replacing the accounts array', async () => {
    const now = Date.parse('2026-11-11T12:00:00Z')
    const accounts = [
      { id: 1, status: 'active', schedulable: true, concurrency: 8, current_concurrency: 2, rate_limit_reset_at: new Date(now + 60_000).toISOString() },
      { id: 2, status: 'active', schedulable: true, concurrency: 8, current_concurrency: 0, auto_pause_on_expired: true, expires_at: (now + 120_000) / 1000 }
    ] as AccountListItem[]
    const wrapper = mount(AccountPoolOverview, { props: { ...overviewProps(), accounts, now }, global: global() })
    const healthCounts = () => wrapper.findAll('.pool-page-metrics > div').slice(0, 4).map(metric => Number(metric.get('dd').text()))
    expect(healthCounts()).toEqual([1, 1, 0, 0])
    const originalAccounts = wrapper.props('accounts')
    await wrapper.setProps({ now: now + 60_000 })
    expect(wrapper.props('accounts')).toBe(originalAccounts)
    expect(healthCounts()).toEqual([2, 0, 0, 0])
    await wrapper.setProps({ now: now + 120_000 })
    expect(wrapper.props('accounts')).toBe(originalAccounts)
    expect(healthCounts()).toEqual([1, 0, 0, 1])
  })

  it('shows group membership and customer deductions without inventing group status buckets', () => {
    const wrapper = mount(AccountPoolOverview, { props: { ...overviewProps(), group: '7' }, global: global() })
    expect(wrapper.get('h2').text()).toBe('Production')
    expect(wrapper.text()).toMatch(/9\s*\/\s*12/)
    expect(wrapper.text()).toContain('Temporarily limited 2')
    expect(wrapper.text()).toMatch(/4\s*\/\s*20/)
    expect(wrapper.text()).toContain('Customer deductions today')
    expect(wrapper.text()).toContain('$12.50')
    expect(wrapper.text()).not.toContain('Errors')
    expect(wrapper.text()).not.toContain('Paused')
  })

  it('retains values with an explicit refresh failure and a working retry', async () => {
    const wrapper = mount(AccountPoolOverview, { props: { ...overviewProps(), group: '7', capacityError: true }, global: global() })
    expect(wrapper.text()).toMatch(/4\s*\/\s*20/)
    expect(wrapper.get('[role="status"]').text()).toContain('Capacity summary could not refresh')
    expect(wrapper.get('[role="status"]').text()).toContain('Showing last successful values')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toEqual([[]])
  })

  it('distinguishes absent values from confirmed zero and omits advanced summaries in simple mode', async () => {
    const wrapper = mount(AccountPoolOverview, { props: { ...overviewProps(), group: '8' }, global: global() })
    expect(wrapper.text()).toMatch(/—\s*\/\s*12/)
    expect(wrapper.text()).toContain('A dash means the summary is unavailable')
    await wrapper.setProps({ group: '7', capacities: { 7: { ...capacity, concurrency_used: 0, concurrency_max: 0 } } })
    expect(wrapper.text()).toMatch(/0\s*\/\s*0/)
    expect(wrapper.text()).not.toContain('A dash means')
    await wrapper.setProps({ simple: true })
    expect(wrapper.text()).not.toContain('Concurrency in use')
    expect(wrapper.text()).not.toContain('Customer deductions today')
    expect(wrapper.text()).toMatch(/9\s*\/\s*12/)
  })
})
