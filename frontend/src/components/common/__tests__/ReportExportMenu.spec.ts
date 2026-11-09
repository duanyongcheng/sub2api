import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import ReportExportMenu from '../ReportExportMenu.vue'

describe('ReportExportMenu', () => {
  it('emits the chosen format and closes itself', async () => {
    const wrapper = mount(ReportExportMenu, { props: { label: '导出报表' } })
    const trigger = wrapper.get('[data-testid="report-export-trigger"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const options = wrapper.findAll('[data-export-format]')
    expect(options.map(option => option.attributes('data-export-format'))).toEqual(['xlsx', 'csv'])

    await wrapper.get('[data-export-format="csv"]').trigger('click')
    expect(wrapper.emitted('export')).toEqual([['csv']])
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('only offers the formats the report can actually produce', async () => {
    const wrapper = mount(ReportExportMenu, { props: { formats: ['xlsx'] as const } })
    await wrapper.get('[data-testid="report-export-trigger"]').trigger('click')
    expect(wrapper.findAll('[data-export-format]').map(option => option.attributes('data-export-format'))).toEqual(['xlsx'])
  })

  it('blocks interaction while an export is running', async () => {
    const wrapper = mount(ReportExportMenu, { props: { busy: true } })
    const trigger = wrapper.get('[data-testid="report-export-trigger"]')
    expect(trigger.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('reportExport.exporting')
    expect(wrapper.emitted('export')).toBeUndefined()
  })

  it('closes on Escape and on an outside pointer press', async () => {
    const wrapper = mount(ReportExportMenu, { attachTo: document.body })
    await wrapper.get('[data-testid="report-export-trigger"]').trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    // Keydown bubbles to the root handler.
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    // Reopen, then press outside the component.
    await wrapper.get('[data-testid="report-export-trigger"]').trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    // jsdom has no PointerEvent; the listener only needs a bubbling event whose target is outside.
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
