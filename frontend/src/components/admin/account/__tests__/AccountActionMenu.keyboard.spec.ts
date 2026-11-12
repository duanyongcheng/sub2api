import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import AccountActionMenu from '../AccountActionMenu.vue'
import type { Account } from '@/types'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
enableAutoUnmount(afterEach)
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const account = { id: 1, platform: 'anthropic', type: 'apikey', status: 'active' } as Account
const getMenu = () => document.body.querySelector<HTMLElement>('.action-menu-content')
const press = (target: EventTarget, key: string, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

async function openMenu() {
  const wrapper = mount(defineComponent({
    components: { AccountActionMenu },
    setup: () => ({ show: ref(false), account, anchorRect: new DOMRect(100, 100, 24, 24) }),
    template: `
      <button data-trigger @click="show = true">More</button>
      <input data-background aria-label="Account search" />
      <AccountActionMenu :show="show" :account="account" :anchor-rect="anchorRect" @close="show = false" />
    `
  }), { attachTo: document.body, global: { stubs: { Icon: true } } })
  const trigger = wrapper.get<HTMLButtonElement>('[data-trigger]')
  trigger.element.focus()
  await trigger.trigger('click')
  await nextTick()
  return { wrapper, trigger: trigger.element, background: wrapper.get<HTMLInputElement>('[data-background]').element }
}

describe('AccountActionMenu keyboard focus', () => {
  it('focuses the first item, navigates within the menu, and restores its trigger on Escape', async () => {
    const { trigger } = await openMenu()
    const buttons = Array.from(getMenu()!.querySelectorAll('button'))
    expect(document.activeElement).toBe(buttons[0])
    expect(press(buttons[0], 'ArrowDown').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons[1])
    press(buttons[1], 'End')
    expect(document.activeElement).toBe(buttons.at(-1))
    press(buttons.at(-1)!, 'Home')
    expect(document.activeElement).toBe(buttons[0])
    press(buttons[0], 'ArrowUp')
    expect(document.activeElement).toBe(buttons.at(-1))
    expect(press(buttons.at(-1)!, 'Escape').defaultPrevented).toBe(true)
    await nextTick()
    expect(getMenu()).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it.each([false, true])('closes on Tab without preventing traversal or restoring trigger focus (shift=%s)', async (shiftKey) => {
    const { trigger, background } = await openMenu()
    const firstItem = getMenu()!.querySelector('button')!
    const focusTrigger = vi.spyOn(trigger, 'focus')
    const event = press(firstItem, 'Tab', shiftKey)
    expect(event.defaultPrevented).toBe(false)
    expect(focusTrigger).not.toHaveBeenCalled()
    // JSDOM has no native Tab traversal; emulate the browser's focus move.
    background.focus()
    await nextTick()
    expect(getMenu()).toBeNull()
    expect(document.activeElement).toBe(background)
    expect(focusTrigger).not.toHaveBeenCalled()
    for (const key of ['Home', 'End', 'ArrowUp', 'ArrowDown']) {
      expect(press(background, key).defaultPrevented).toBe(false)
      expect(document.activeElement).toBe(background)
    }
  })

  it('does not intercept navigation or Escape from outside an open menu', async () => {
    const { background } = await openMenu()
    background.focus()
    for (const key of ['Home', 'End', 'ArrowUp', 'ArrowDown', 'Escape']) {
      expect(press(background, key).defaultPrevented).toBe(false)
      expect(document.activeElement).toBe(background)
    }
    await nextTick()
    expect(getMenu()).not.toBeNull()
  })
})
