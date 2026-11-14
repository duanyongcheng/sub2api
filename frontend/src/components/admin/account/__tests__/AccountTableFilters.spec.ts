import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import AccountTableFilters from '../AccountTableFilters.vue'
import Select from '@/components/common/Select.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
enableAutoUnmount(afterEach)
afterEach(() => { document.body.innerHTML = '' })

const baseFilters = { status: 'active', type: '', privacy_mode: '', group: '', platform: 'openai' }

function mountFilters(props: Record<string, unknown> = {}) {
  return mount(AccountTableFilters, {
    attachTo: document.body,
    props: { searchQuery: '', filters: { ...baseFilters }, ...props },
    global: { stubs: { Icon: true } }
  })
}

const selectLabels = (wrapper: ReturnType<typeof mountFilters>) =>
  wrapper.findAllComponents(Select).map(select => select.props('ariaLabel'))

describe('AccountTableFilters flat layout', () => {
  it('renders every filter select inline without a disclosure, panel or chips', () => {
    const wrapper = mountFilters()
    expect(wrapper.find('.account-filter-toggle').exists()).toBe(false)
    expect(wrapper.find('[aria-controls]').exists()).toBe(false)
    expect(selectLabels(wrapper)).toEqual([
      'admin.accounts.columns.status',
      'admin.accounts.columns.platform',
      'admin.accounts.columns.groups',
      'admin.accounts.columns.type',
      'admin.accounts.workspace.privacyStatus'
    ])
    const row = wrapper.get('.account-primary-filters')
    expect(row.findAllComponents(Select)).toHaveLength(5)
    expect(wrapper.get('.account-filters').element.children).toHaveLength(1)
    expect(wrapper.text()).not.toContain('admin.accounts.workspace.clearFilters')
  })

  it('hides the platform and group selects when the navigator owns them', () => {
    const wrapper = mountFilters({ hidePlatform: true, hideGroup: true })
    expect(selectLabels(wrapper)).toEqual([
      'admin.accounts.columns.status',
      'admin.accounts.columns.type',
      'admin.accounts.workspace.privacyStatus'
    ])
  })

  it('shows the default option as the visible label of the type and privacy selects', () => {
    const wrapper = mountFilters({ hidePlatform: true, hideGroup: true })
    expect(wrapper.get('button[aria-label="admin.accounts.columns.type"]').text()).toBe('admin.accounts.allTypes')
    expect(wrapper.get('button[aria-label="admin.accounts.workspace.privacyStatus"]').text()).toBe('admin.accounts.allPrivacyModes')
  })

  it.each([
    ['admin.accounts.columns.type', 'type', 'oauth'],
    ['admin.accounts.workspace.privacyStatus', 'privacy_mode', 'training_off'],
    ['admin.accounts.columns.platform', 'platform', 'anthropic'],
    ['admin.accounts.columns.groups', 'group', 'ungrouped']
  ])('emits merged filters and change when %s changes', async (label, key, value) => {
    const wrapper = mountFilters()
    const select = wrapper.findAllComponents(Select).find(item => item.props('ariaLabel') === label)!
    select.vm.$emit('update:modelValue', value)
    select.vm.$emit('change', value)
    expect(wrapper.emitted('update:filters')).toEqual([[{ ...baseFilters, [key]: value }]])
    expect(wrapper.emitted('change')).toHaveLength(1)
  })

  it('selects a type option through the real dropdown', async () => {
    const wrapper = mountFilters({ hidePlatform: true, hideGroup: true })
    await wrapper.get('button[aria-label="admin.accounts.columns.type"]').trigger('click')
    const option = Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'))
      .find(item => item.textContent?.trim() === 'admin.accounts.apiKey')!
    expect(option).toBeDefined()
    option.click()
    expect(wrapper.emitted('update:filters')).toEqual([[{ ...baseFilters, type: 'apikey' }]])
    expect(wrapper.emitted('change')).toHaveLength(1)
  })
})
