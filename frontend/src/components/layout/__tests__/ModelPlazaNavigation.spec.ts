import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import en from '@/i18n/locales/en'
import { useAppStore, useAuthStore, useAdminSettingsStore } from '@/stores'
import type { PublicSettings, User } from '@/types'
import AppSidebar from '../AppSidebar.vue'
import AppHeader from '../AppHeader.vue'

// Keep navigation, stores and feature-flag resolution real; isolate unrelated
// API-loading children and the sidebar's batch-image entitlement lookup.
vi.mock('@/composables/useBatchImageAccess', () => ({
  useBatchImageAccess: () => ({
    canUseBatchImage: ref(false),
    refreshBatchImageAccess: vi.fn().mockResolvedValue(false)
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    // The test runtime excludes the message compiler; function messages reuse
    // the existing English labels without needing compilation.
    en: {
      nav: Object.fromEntries(Object.entries(en.nav).map(([key, text]) => [key, () => text])),
      common: Object.fromEntries(Object.entries(en.common).map(([key, text]) => [key, () => text]))
    }
  }
})

const Shell = defineComponent({
  setup: () => () => h('div', [h(AppSidebar), h(AppHeader)])
})
const plazaLink = 'a[href="/model-plaza?embedded=1"]'
const modes = [
  { role: 'user', mode: 'standard', sidebar: true },
  { role: 'user', mode: 'simple', sidebar: true },
  { role: 'admin', mode: 'standard', sidebar: true },
  // Admin simple mode deliberately omits the entire personal section.
  { role: 'admin', mode: 'simple', sidebar: false }
] as const

let wrapper: VueWrapper | undefined
const originalWidth = window.innerWidth

function settings(enabled?: boolean): PublicSettings {
  return {
    model_plaza_enabled: enabled,
    subscription_enabled: false,
    custom_menu_items: []
  } as PublicSettings
}

async function mountShell(
  role: User['role'] = 'user',
  mode: 'standard' | 'simple' = 'standard',
  enabled: boolean | undefined = true,
  width = 1280
) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  const pinia = createPinia()
  setActivePinia(pinia)
  const app = useAppStore()
  app.cachedPublicSettings = settings(enabled)
  app.publicSettingsLoaded = true
  app.docUrl = 'https://example.test/docs'
  const auth = useAuthStore()
  vi.spyOn(auth, 'isSimpleMode', 'get').mockReturnValue(mode === 'simple')
  auth.user = {
    id: 1, username: 'Navigation Test', email: 'navigation@example.test', role,
    balance: 0, concurrency: 1, status: 'active', allowed_groups: null,
    balance_notify_enabled: false, balance_notify_threshold: null,
    balance_notify_extra_emails: [], created_at: '', updated_at: ''
  }
  vi.spyOn(useAdminSettingsStore(), 'fetch').mockResolvedValue(undefined)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
  await router.push('/keys')
  await router.isReady()
  wrapper = mount(Shell, {
    global: {
      plugins: [pinia, router, i18n],
      stubs: {
        VersionBadge: true, AnnouncementBell: true,
        LocaleSwitcher: true, SubscriptionProgressMini: true
      }
    }
  })
  await flushPromises()
  return { app, auth, router, wrapper }
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
  document.documentElement.classList.remove('dark')
})

describe('Model plaza shell navigation', () => {
  it.each(modes)('offers embedded access for $role in $mode mode', async ({ role, mode, sidebar }) => {
    const { wrapper, router } = await mountShell(role, mode)
    const headerLink = wrapper.get('header').get(plazaLink)
    expect(headerLink.attributes('aria-label')).toBe(i18n.global.t('nav.modelPlaza'))
    await headerLink.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/model-plaza')
    expect(router.currentRoute.value.query).toEqual({ embedded: '1' })

    const sidebarLinks = wrapper.get('aside').findAll(plazaLink)
    expect(sidebarLinks).toHaveLength(sidebar ? 1 : 0)
    if (sidebar) {
      const link = sidebarLinks[0]
      expect(link.text()).toBe(i18n.global.t('nav.modelPlaza'))
      expect(link.classes()).toContain('sidebar-link-active')
      const section = link.element.closest('.sidebar-section')
      expect(section?.textContent).toContain(i18n.global.t(role === 'admin' ? 'nav.myAccount' : 'nav.groupService'))
      await router.push('/keys')
      await nextTick()
      expect(link.classes()).not.toContain('sidebar-link-active')
      await link.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toBe('/model-plaza?embedded=1')
      expect(link.classes()).toContain('sidebar-link-active')
    }
  })

  it.each(modes)('hides both entries when disabled for $role in $mode mode', async ({ role, mode }) => {
    const { wrapper } = await mountShell(role, mode, false)
    expect(wrapper.findAll(plazaLink)).toHaveLength(0)
  })

  it('follows opt-in settings arriving and changing after mount', async () => {
    const { wrapper, app } = await mountShell()
    app.cachedPublicSettings = settings(undefined)
    await nextTick()
    expect(wrapper.findAll(plazaLink)).toHaveLength(0)
    app.cachedPublicSettings = settings(true)
    await nextTick()
    expect(wrapper.findAll(plazaLink)).toHaveLength(2)
    app.cachedPublicSettings = settings(false)
    await nextTick()
    expect(wrapper.findAll(plazaLink)).toHaveLength(0)
  })

  it.each([375, 1280])('keeps the header plaza control available at %ipx', async (width) => {
    const { wrapper } = await mountShell('user', 'standard', true, width)
    const link = wrapper.get('header').get(plazaLink)
    expect(link.classes()).toContain('topbar-icon')
    expect(link.classes()).not.toContain('hidden')
    expect(link.classes()).not.toContain('sm:grid')
    expect(link.isVisible()).toBe(true)
    // The docs control keeps its existing responsive visibility.
    expect(wrapper.get('a[href="https://example.test/docs"]').classes()).toContain('hidden')
  })

  it('navigates through the mobile sidebar and closes the menu', async () => {
    const { wrapper, router, app } = await mountShell('user', 'simple', true, 375)
    vi.useFakeTimers()
    await wrapper.get(`button[aria-label="${i18n.global.t('common.toggleMenu')}"]`).trigger('click')
    expect(app.mobileOpen).toBe(true)
    expect(wrapper.get('aside').classes()).not.toContain('-translate-x-full')
    await wrapper.get('aside').get(plazaLink).trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/model-plaza?embedded=1')
    await vi.advanceTimersByTimeAsync(150)
    expect(app.mobileOpen).toBe(false)
    expect(wrapper.get('aside').classes()).toContain('-translate-x-full')
  })

  it('retains active styling and a usable title when the sidebar is collapsed', async () => {
    const { wrapper, app, router } = await mountShell()
    app.sidebarCollapsed = true
    await router.push('/model-plaza?embedded=1')
    await nextTick()
    const link = wrapper.get('aside').get(plazaLink)
    expect(link.classes()).toContain('sidebar-link-collapsed')
    expect(link.classes()).toContain('sidebar-link-active')
    expect(link.attributes('title')).toBe(i18n.global.t('nav.modelPlaza'))
  })
})
