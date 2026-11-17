import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import AccountIdentityChips from '../AccountIdentityChips.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => {
        const dict: Record<string, string> = {
          'admin.accounts.privacyTrainingOff': '已关闭训练数据共享',
          'admin.accounts.subscriptionExpires': '到期'
        }
        return dict[key] ?? key
      }
    })
  }
})

describe('AccountIdentityChips', () => {
  const wrappers: VueWrapper[] = []

  const mountChips = (props: InstanceType<typeof AccountIdentityChips>['$props']) => {
    const wrapper = mount(AccountIdentityChips, {
      props,
      attachTo: document.body
    })
    wrappers.push(wrapper)
    return wrapper
  }

  afterEach(() => {
    while (wrappers.length > 0) {
      wrappers.pop()?.unmount()
    }
    document.body.innerHTML = ''
  })

  it('teleports the compact disclosure panel to document.body outside sticky table cells', async () => {
    const wrapper = mountChips({
      compact: true,
      row: { platform: 'openai', type: 'oauth' },
      planType: 'chatgptpro',
      privacyMode: 'training_off',
      subscriptionExpiresAt: '2026-12-15T00:00:00Z',
      compactMeta: {
        label: '压缩自动',
        className: 'text-slate-500',
        dotClass: 'bg-slate-300'
      },
      compactTitle: '压缩自动 | 上次检测: 2026-11-17 15:00'
    })

    const trigger = wrapper.get('[data-testid="account-identity-disclosure-trigger"]')
    expect(trigger.text()).toBe('OAuth · Pro 200')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).toContain('Private')
    expect(document.body.querySelector('[data-testid="account-identity-disclosure-panel"]')).toBeNull()

    await trigger.trigger('click')
    await nextTick()

    expect(trigger.attributes('aria-expanded')).toBe('true')
    // Must not render inside the component's own cell subtree (escapes sticky td stacking context)
    expect(wrapper.element.querySelector('[data-testid="account-identity-disclosure-panel"]')).toBeNull()

    const panel = document.body.querySelector('[data-testid="account-identity-disclosure-panel"]')
    expect(panel).not.toBeNull()
    expect(panel?.parentElement).toBe(document.body)
    expect(panel?.textContent).toContain('OAuth')
    expect(panel?.textContent).toContain('Pro 200')
    expect(panel?.textContent).toContain('Private')
    expect(panel?.textContent).toContain('Pro 200 · chatgptpro')
    expect(panel?.textContent).toContain('已关闭训练数据共享')
    expect(panel?.textContent).toContain('压缩自动 | 上次检测: 2026-11-17 15:00')
    expect(panel?.textContent).toContain('到期 2026-12-15')
  })

  it('avoids duplicate raw plan text when raw plan matches display label', async () => {
    const wrapper = mountChips({
      compact: true,
      row: { platform: 'openai', type: 'oauth' },
      planType: 'plus',
      privacyMode: 'training_off'
    })

    const trigger = wrapper.get('[data-testid="account-identity-disclosure-trigger"]')
    expect(trigger.attributes('title')).not.toContain('Plus · plus')

    await trigger.trigger('click')
    await nextTick()

    const panel = document.body.querySelector('[data-testid="account-identity-disclosure-panel"]')
    expect(panel?.textContent).toContain('Plus')
    expect(panel?.textContent).not.toContain('Plus · plus')
  })

  it('keeps at most one row popover open at a time', async () => {
    const row1 = mountChips({
      compact: true,
      row: { platform: 'openai', type: 'oauth' },
      planType: 'chatgptpro',
      privacyMode: 'training_off'
    })
    const row2 = mountChips({
      compact: true,
      row: { platform: 'openai', type: 'oauth' },
      planType: 'prolite',
      privacyMode: 'training_off'
    })

    const trigger1 = row1.get('[data-testid="account-identity-disclosure-trigger"]')
    const trigger2 = row2.get('[data-testid="account-identity-disclosure-trigger"]')

    await trigger1.trigger('click')
    await nextTick()
    expect(document.body.querySelectorAll('[data-testid="account-identity-disclosure-panel"]')).toHaveLength(1)
    expect(trigger1.attributes('aria-expanded')).toBe('true')

    await trigger2.trigger('click')
    await nextTick()
    const panels = document.body.querySelectorAll('[data-testid="account-identity-disclosure-panel"]')
    expect(panels).toHaveLength(1)
    expect(trigger1.attributes('aria-expanded')).toBe('false')
    expect(trigger2.attributes('aria-expanded')).toBe('true')
    expect(panels[0]?.textContent).toContain('Pro 100')
  })

  it('closes on outside click, Escape (restoring focus), and table scroll', async () => {
    const wrapper = mountChips({
      compact: true,
      row: { platform: 'openai', type: 'oauth' },
      planType: 'chatgptpro',
      privacyMode: 'training_off'
    })

    const trigger = wrapper.get('[data-testid="account-identity-disclosure-trigger"]')
    await trigger.trigger('click')
    await nextTick()
    expect(document.body.querySelector('[data-testid="account-identity-disclosure-panel"]')).not.toBeNull()

    // Outside click closes
    document.body.click()
    await nextTick()
    expect(document.body.querySelector('[data-testid="account-identity-disclosure-panel"]')).toBeNull()

    // Reopen and press Escape -> closes and restores focus to trigger
    await trigger.trigger('click')
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(document.body.querySelector('[data-testid="account-identity-disclosure-panel"]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)

    // Reopen and scroll outside panel -> closes
    await trigger.trigger('click')
    await nextTick()
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(document.body.querySelector('[data-testid="account-identity-disclosure-panel"]')).toBeNull()
  })

  it('flips above the trigger when viewport space below is insufficient', async () => {
    Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })

    const wrapper = mountChips({
      compact: true,
      row: { platform: 'openai', type: 'oauth' },
      planType: 'chatgptpro',
      privacyMode: 'training_off'
    })

    const trigger = wrapper.get('[data-testid="account-identity-disclosure-trigger"]')
    vi.spyOn(trigger.element, 'getBoundingClientRect').mockReturnValue({
      x: 80,
      y: 450,
      top: 450,
      bottom: 470,
      left: 80,
      right: 200,
      width: 120,
      height: 20,
      toJSON: () => ({})
    })

    await trigger.trigger('click')
    await nextTick()

    const panel = document.body.querySelector<HTMLElement>('[data-testid="account-identity-disclosure-panel"]')
    expect(panel).not.toBeNull()
    vi.spyOn(panel!, 'getBoundingClientRect').mockReturnValue({
      x: 80,
      y: 476,
      top: 476,
      bottom: 596,
      left: 80,
      right: 300,
      width: 220,
      height: 120,
      toJSON: () => ({})
    })

    window.dispatchEvent(new Event('resize'))
    await nextTick()

    expect(panel!.style.top).toBe('324px') // 450 - 120 - 6
    expect(panel!.style.left).toBe('80px')
  })
})
