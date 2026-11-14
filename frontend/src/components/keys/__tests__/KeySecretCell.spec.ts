import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KeySecretCell from '../KeySecretCell.vue'
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
describe('temporary key visibility', () => {
  afterEach(() => vi.useRealTimers())
  it('masks again after ten seconds and immediately when the key changes', async () => {
    vi.useFakeTimers()
    const key = 'sk-testing-key-secret-1234567890'
    const wrapper = mount(KeySecretCell, { props: { value: key, copied: false } })
    expect(wrapper.get('code').text()).not.toBe(key)
    await wrapper.get('[aria-label="keys.showKey"]').trigger('click')
    expect(wrapper.get('code').text()).toBe(key)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(wrapper.get('code').text()).not.toBe(key)
    await wrapper.get('[aria-label="keys.showKey"]').trigger('click')
    await wrapper.setProps({ value: 'sk-new-value-secret-9876543210' })
    expect(wrapper.get('code').text()).not.toBe('sk-new-value-secret-9876543210')
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
