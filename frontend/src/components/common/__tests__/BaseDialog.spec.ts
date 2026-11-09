import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import BaseDialog from '../BaseDialog.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('BaseDialog', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.classList.remove('modal-open')
  })

  it('resets body scroll position when reopened', async () => {
    const wrapper = mount(BaseDialog, {
      attachTo: document.body,
      props: { show: false, title: 'Details' },
      slots: { default: '<div style="height: 2000px">content</div>' },
      global: { stubs: { Icon: true } }
    })

    await wrapper.setProps({ show: true })
    await nextTick()
    const body = document.body.querySelector<HTMLElement>('.modal-body')
    expect(body).not.toBeNull()
    body!.scrollTop = 480

    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    await nextTick()

    expect(document.body.querySelector<HTMLElement>('.modal-body')?.scrollTop).toBe(0)
    wrapper.unmount()
  })

  it.each([undefined, false, true])('uses the explicit scrim-close preference for drawers: %s', async preference => {
    const wrapper = mount(BaseDialog, {
      attachTo: document.body,
      props: { show: true, title: 'Drawer', variant: 'drawer', ...(preference === undefined ? {} : { closeOnClickOutside: preference }) },
      global: { stubs: { Icon: true } }
    })
    await nextTick()
    document.body.querySelector<HTMLElement>('.modal-overlay')!.click()
    expect(Boolean(wrapper.emitted('close'))).toBe(preference ?? true)
    wrapper.unmount()
  })
})
