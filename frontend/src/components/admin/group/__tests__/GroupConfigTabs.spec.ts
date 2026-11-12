import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GroupConfigTabs from '../GroupConfigTabs.vue'

vi.mock('vue-i18n', async importOriginal => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key })
}))

describe('GroupConfigTabs', () => {
  const tabs = ['basic', 'pricing', 'models'] as const

  it('uses roving focus and moves with arrow, Home and End keys', async () => {
    const wrapper = mount(GroupConfigTabs, {
      props: { modelValue: 'basic', availableTabs: [...tabs] },
      attachTo: document.body
    })
    const buttons = wrapper.findAll('[role="tab"]')
    expect(buttons).toHaveLength(3)
    expect(buttons[0].attributes('tabindex')).toBe('0')
    expect(buttons[1].attributes('tabindex')).toBe('-1')

    await buttons[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['pricing'])

    await buttons[2].trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['basic'])

    await buttons[0].trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')?.[2]).toEqual(['models'])
    wrapper.unmount()
  })

  it('keeps a single basic tab in simple mode', () => {
    const wrapper = mount(GroupConfigTabs, { props: { modelValue: 'basic', simple: true } })
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(1)
    wrapper.unmount()
  })
})
