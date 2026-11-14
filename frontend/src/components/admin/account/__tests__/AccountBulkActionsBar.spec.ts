import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import AccountBulkActionsBar from '../AccountBulkActionsBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('AccountBulkActionsBar', () => {
  it('allows selecting all results before any row is selected', async () => {
    const wrapper = mount(AccountBulkActionsBar, {
      props: {
        selectedIds: [],
        totalResults: 45,
        selectingAll: false,
        allResultsSelected: false
      }
    })

    const button = wrapper.findAll('button').find(item =>
      item.text().includes('admin.accounts.bulkActions.selectAllResults')
    )

    expect(button).toBeDefined()
    await button!.trigger('click')
    expect(wrapper.emitted('select-all-results')).toHaveLength(1)
  })

  it('keeps primary actions visible and all secondary actions in the disclosure', async () => {
    const wrapper = mount(AccountBulkActionsBar, {
      props: {
        selectedIds: [1, 2],
        totalResults: 45,
        selectingAll: false,
        allResultsSelected: false
      }
    })
    const actions = [
      ['edit', 'edit-selected', false],
      ['enableScheduling', 'toggle-schedulable', false],
      ['disableScheduling', 'toggle-schedulable', false],
      ['refreshToken', 'refresh-token', false],
      ['resetStatus', 'reset-status', true],
      ['probeUpstreamBilling', 'probe-upstream-billing', true],
      ['delete', 'delete', true]
    ] as const

    for (const [key, event, secondary] of actions) {
      const button = wrapper.findAll('button').find(item =>
        item.text() === `admin.accounts.bulkActions.${key}`
      )!
      expect(Boolean(button.element.closest('details'))).toBe(secondary)
      if (secondary) wrapper.get('details').element.open = true
      await button.trigger('click')
      expect(wrapper.emitted(event)).toBeDefined()
      if (secondary) expect(wrapper.get('details').element.open).toBe(false)
    }
    expect(wrapper.emitted('toggle-schedulable')).toEqual([[true], [false]])

    const filteredEdit = wrapper.get('details').findAll('button').find(item =>
      item.text() === 'admin.accounts.bulkEdit.submit'
    )!
    await filteredEdit.trigger('click')
    expect(wrapper.emitted('edit-filtered')).toHaveLength(1)
  })

  it('preserves selection controls, loading guards, and all-results scope', async () => {
    const wrapper = mount(AccountBulkActionsBar, {
      props: {
        selectedIds: [1],
        totalResults: 45,
        selectingAll: true,
        allResultsSelected: false
      }
    })
    const selectPage = wrapper.findAll('button').find(item =>
      item.text() === 'admin.accounts.bulkActions.selectCurrentPage'
    )!
    const clear = wrapper.findAll('button').find(item =>
      item.text() === 'admin.accounts.bulkActions.clear'
    )!
    const selectingAll = wrapper.findAll('button').find(item =>
      item.text() === 'admin.accounts.bulkActions.selectingAll'
    )!
    await selectPage.trigger('click')
    await clear.trigger('click')
    await selectingAll.trigger('click')
    expect(wrapper.emitted('select-page')).toHaveLength(1)
    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.emitted('select-all-results')).toBeUndefined()

    await wrapper.setProps({ selectedIds: [1, 2], allResultsSelected: true, selectingAll: false })
    expect(wrapper.text()).toContain('admin.accounts.bulkActions.selectedAll')
    expect(wrapper.text()).not.toContain('admin.accounts.bulkActions.selectAllResults')
  })

  it('closes the disclosure on Escape and retains standalone filtered edit without selection', async () => {
    const wrapper = mount(AccountBulkActionsBar, {
      props: {
        selectedIds: [],
        totalResults: 45,
        selectingAll: false,
        allResultsSelected: false
      }
    })
    const details = wrapper.get('details')
    details.element.open = true
    await details.trigger('keydown', { key: 'Escape' })
    expect(details.element.open).toBe(false)
    const buttons = details.findAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].text()).toBe('admin.accounts.bulkEdit.submit')
    await buttons[0].trigger('click')
    expect(wrapper.emitted('edit-filtered')).toHaveLength(1)
  })

  it('preserves the upstream billing probe action from v0.1.166', async () => {
    const wrapper = mount(AccountBulkActionsBar, {
      props: {
        selectedIds: [1],
        totalResults: 45,
        selectingAll: false,
        allResultsSelected: false
      }
    })

    const button = wrapper.findAll('button').find(item =>
      item.text().includes('admin.accounts.bulkActions.probeUpstreamBilling')
    )

    expect(button).toBeDefined()
    await button!.trigger('click')
    expect(wrapper.emitted('probe-upstream-billing')).toHaveLength(1)
  })
})
