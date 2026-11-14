import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GroupDirectory from '../GroupDirectory.vue'
import Select from '@/components/common/Select.vue'
import type { AdminGroup } from '@/types'

vi.mock('vue-i18n', async importOriginal => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key })
}))

const group = (overrides: Partial<AdminGroup> = {}): AdminGroup => ({
  id: 1,
  name: 'Claude Pro',
  description: null,
  platform: 'anthropic',
  rate_multiplier: 0.8,
  status: 'active',
  subscription_type: 'standard',
  account_count: 86,
  active_account_count: 78,
  rate_limited_account_count: 6,
  is_exclusive: false,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
} as AdminGroup)

const baseProps = {
  groups: [group(), group({ id: 2, name: 'OpenAI Standard', platform: 'openai', status: 'inactive', account_count: 12 })],
  selectedId: 1,
  loading: false,
  search: '',
  platform: '',
  status: '',
  platformOptions: [{ value: '', label: 'All platforms' }, { value: 'openai', label: 'OpenAI' }],
  statusOptions: [{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
  total: 2,
  simple: false
}

describe('GroupDirectory', () => {
  it('renders the directory and marks the selected group', () => {
    const wrapper = mount(GroupDirectory, {
      props: baseProps,
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { Select: true }
      }
    })
    const rows = wrapper.findAll('[data-group-id]')
    expect(rows).toHaveLength(2)
    expect(rows[0].attributes('aria-current')).toBe('true')
    expect(rows[1].attributes('aria-current')).toBeUndefined()
    expect(wrapper.text()).toContain('Claude Pro')
    expect(wrapper.text()).toContain('OpenAI Standard')
    wrapper.unmount()
  })

  it('emits selection, search, status and sort events without workspace pagination', async () => {
    const wrapper = mount(GroupDirectory, {
      props: baseProps,
      global: { stubs: { Select: true } }
    })
    await wrapper.findAll('[data-group-id]')[1].trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([baseProps.groups[1]])

    await wrapper.get('input[type="search"]').setValue('openai')
    expect(wrapper.emitted('search')?.[0]).toEqual(['openai'])

    const statusButtons = wrapper.findAll('.status-filter-button')
    await statusButtons[1].trigger('click')
    expect(wrapper.emitted('status')?.[0]).toEqual(['active'])

    expect(wrapper.find('button[aria-label="pagination.next"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="pagination.previous"]').exists()).toBe(false)

    await wrapper.get('button[aria-label="admin.groups.sortOrder"]').trigger('click')
    expect(wrapper.emitted('sort')).toHaveLength(1)

    await wrapper.get('button[aria-label="common.refresh"]').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)

    await wrapper.get('button[aria-label="admin.groups.workspace.tableView"]').trigger('click')
    expect(wrapper.emitted('view')).toHaveLength(1)

    await wrapper.get('button[aria-label="admin.groups.createGroup"]').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits the platform filter through the shared select', async () => {
    const wrapper = mount(GroupDirectory, {
      props: baseProps,
      global: { stubs: { Select: true } }
    })
    wrapper.findComponent(Select).vm.$emit('update:modelValue', 'openai')
    expect(wrapper.emitted('platform')?.[0]).toEqual(['openai'])
    wrapper.unmount()
  })

  it('closes the mobile disclosure after a selection and exposes the current group', async () => {
    const wrapper = mount(GroupDirectory, {
      props: baseProps,
      global: { stubs: { Select: true } }
    })
    const trigger = wrapper.get('button[aria-controls]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await wrapper.findAll('[data-group-id]')[0].trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).toContain('Claude Pro')
    wrapper.unmount()
  })

  it('offers a clear action only when a filter is active', async () => {
    const wrapper = mount(GroupDirectory, {
      props: { ...baseProps, groups: [], total: 0, search: 'missing' },
      global: { stubs: { Select: true } }
    })
    expect(wrapper.text()).toContain('admin.groups.workspace.noMatchingGroups')
    const clear = wrapper.findAll('button').find(button => button.text().includes('admin.groups.workspace.clearFilters'))
    expect(clear).toBeTruthy()
    await clear!.trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    wrapper.unmount()
  })
})
