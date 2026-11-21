import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import en from '@/i18n/locales/en'
import zh from '@/i18n/locales/zh'
import { routes } from '@/router'
import type { IQDetectionConfig } from '../types'
import type {
  IQDetectionPublicOverview,
  IQDetectionPublicRun
} from '../user/publicTypes'
import IQDetectionPublicView from '../user/IQDetectionPublicView.vue'
import IQDetectionSettingsPanel from '../IQDetectionSettingsPanel.vue'
import {
  __resetIQDetectionVisibilityForTests,
  refreshIQDetectionVisibility,
  setIQDetectionVisibility,
  useIQDetectionVisibility
} from '../user/useIQDetectionVisibility'
import { isIQDetectionNotPublicError } from '../user/publicApi'
import { resolvePublicBenchmarks, resolvePublicRunScore } from '../user/publicMeta'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path: string) => readFileSync(resolve(here, path), 'utf8')

const publicApiMocks = vi.hoisted(() => ({
  getIQDetectionVisibility: vi.fn(),
  getIQDetectionPublicOverview: vi.fn(),
  listIQDetectionPublicRuns: vi.fn()
}))

const adminApiMocks = vi.hoisted(() => ({
  getIQDetectionConfig: vi.fn(),
  updateIQDetectionConfig: vi.fn(),
  getIQDetectionOverview: vi.fn(),
  listIQDetectionRuns: vi.fn(),
  runIQDetectionNow: vi.fn(),
  fetchAllOpenAIGroups: vi.fn()
}))

const authState = vi.hoisted(() => ({
  value: null as null | { isAuthenticated: boolean; user: { id: number } | null }
}))

const storeMocks = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn()
}))

vi.mock('../user/publicApi', async () => {
  const actual = await vi.importActual<typeof import('../user/publicApi')>('../user/publicApi')
  return { ...actual, ...publicApiMocks }
})

vi.mock('../api', () => adminApiMocks)

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => {
    if (!authState.value) throw new Error('no active pinia')
    return authState.value
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => storeMocks
}))

vi.mock('@/utils/format', () => ({
  formatRelativeTime: (d: string | null | undefined) => (d ? `rel(${d})` : 'never')
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  const lookup = (obj: Record<string, unknown>, path: string): string => {
    const val = path.split('.').reduce<unknown>((acc, seg) => {
      if (acc && typeof acc === 'object' && seg in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[seg]
      }
      return undefined
    }, obj)
    return typeof val === 'string' ? val : path
  }
  return {
    ...actual,
    useI18n: () => ({
      locale: { value: 'zh' },
      t: (key: string, params?: Record<string, unknown>) => {
        const tpl = lookup(zh as unknown as Record<string, unknown>, key)
        return tpl.replace(/\{(\w+)\}/g, (_, token) => String(params?.[token] ?? `{${token}}`))
      }
    })
  }
})

const AppLayoutStub = { template: '<div data-testid="app-layout"><slot /></div>' }

const candyRun = (overrides: Partial<IQDetectionPublicRun> = {}): IQDetectionPublicRun => ({
  id: 501,
  group_id: 10,
  group_name: 'Codex Pro Pool',
  benchmark_type: 'candy_logic',
  requested_model: 'gpt-5.4',
  reasoning_effort: 'medium',
  tests_count: 3,
  graded_count: 3,
  correct_count: 2,
  avg_score: null,
  verdict: 'warning',
  avg_latency_ms: 4200,
  avg_tps: 120,
  started_at: '2026-11-20T08:00:00Z',
  completed_at: '2026-11-20T08:00:05Z',
  artifacts: [],
  ...overrides
})

const pelicanRun = (overrides: Partial<IQDetectionPublicRun> = {}): IQDetectionPublicRun => ({
  ...candyRun(),
  id: 777,
  benchmark_type: 'pelican_svg',
  tests_count: 1,
  graded_count: 1,
  correct_count: 1,
  avg_score: 88,
  verdict: 'normal',
  artifacts: [
    {
      html: '<!doctype html><html><body><svg viewBox="0 0 10 10"><circle r="4"/></svg></body></html>',
      score: 88,
      offline_compliant: true
    }
  ],
  ...overrides
})

const sampleOverview = (): IQDetectionPublicOverview => ({
  benchmark_types: ['candy_logic', 'pelican_svg'],
  interval_minutes: 720,
  model: 'gpt-5.4',
  reasoning_effort: 'medium',
  last_scheduled_at: '2026-11-20T08:00:00Z',
  groups: [
    {
      group_id: 10,
      group_name: 'Codex Pro Pool',
      platform: 'openai',
      health: 'warning',
      latest_runs_by_benchmark: {
        candy_logic: candyRun(),
        pelican_svg: pelicanRun()
      }
    },
    {
      group_id: 20,
      group_name: 'Fresh Pool',
      platform: 'openai',
      health: null,
      latest_runs_by_benchmark: {}
    }
  ]
})

const notPublicError = () => ({
  status: 403,
  code: 403,
  reason: 'IQ_DETECTION_NOT_PUBLIC',
  message: 'IQ detection is not public'
})

function mountView() {
  return mount(IQDetectionPublicView, {
    global: {
      stubs: { AppLayout: AppLayoutStub, RouterLink: RouterLinkStub }
    }
  })
}

function resetAll() {
  Object.values(publicApiMocks).forEach((fn) => fn.mockReset())
  Object.values(adminApiMocks).forEach((fn) => fn.mockReset())
  Object.values(storeMocks).forEach((fn) => fn.mockReset())
  authState.value = reactive({ isAuthenticated: true, user: { id: 7 } })
  __resetIQDetectionVisibilityForTests()
}

describe('User IQ detection route & navigation boundary', () => {
  it('registers /iq-detection as an authenticated, non-admin route', () => {
    const matched = routes.find((r) => r.path === '/iq-detection')
    expect(matched).toBeDefined()
    expect(matched?.name).toBe('UserIQDetection')
    expect(matched?.meta).toMatchObject({
      requiresAuth: true,
      requiresAdmin: false,
      titleKey: 'iqDetection.public.title'
    })
  })

  it('adds the sidebar entry to the self (user) groups, gated strictly by the visibility switch', () => {
    const sidebar = read('../../../components/layout/AppSidebar.vue')
    const selfStart = sidebar.indexOf('function buildSelfGroups')
    const selfEnd = sidebar.indexOf('function finalizeGroups')
    const adminStart = sidebar.indexOf('const adminNavGroups = computed')
    const selfSection = sidebar.slice(selfStart, selfEnd)

    expect(selfSection).toMatch(/path: '\/iq-detection',[\s\S]{0,200}?featureFlag: flagIQDetectionPublic/)
    expect(sidebar.slice(adminStart)).not.toContain("path: '/iq-detection'")
    // Unknown must not count as visible (featureFlag treats undefined as shown).
    expect(sidebar).toContain('const flagIQDetectionPublic = () => iqDetectionPublic.value === true')
    expect(sidebar).toMatch(/onMounted\(\(\) => \{[\s\S]{0,200}?refreshIQDetectionVisibility\(\)/)
  })

  it('keeps the user page free of admin-only data and controls in source', () => {
    const files = [
      '../user/IQDetectionPublicView.vue',
      '../user/IQDetectionPublicGroupSheet.vue',
      '../user/IQDetectionPublicTrend.vue',
      '../user/IQDetectionPublicGallery.vue',
      '../user/publicApi.ts'
    ].map(read)
    for (const src of files) {
      expect(src).not.toMatch(/runIQDetectionNow|updateIQDetectionConfig|\/admin\/iq-detection/)
      expect(src).not.toMatch(/error_message|response_model|answer_preview|account_name|reasoning_tokens|output_tokens/)
      expect(src).not.toContain('allow-same-origin')
      expect(src).not.toContain('srcdoc')
    }
  })
})

describe('IQDetectionPublicView', () => {
  beforeEach(() => {
    resetAll()
    publicApiMocks.listIQDetectionPublicRuns.mockImplementation(
      async (params: { group_id: number; benchmark_type: string }) => ({
        items:
          params.benchmark_type === 'pelican_svg'
            ? [pelicanRun(), pelicanRun({ id: 776, avg_score: 40, verdict: 'degraded' })]
            : [candyRun(), candyRun({ id: 500, verdict: 'normal', correct_count: 3 }), candyRun({ id: 499, verdict: 'error', graded_count: 0, correct_count: 0 })],
        total: 3,
        page: 1,
        page_size: 24,
        pages: 1
      })
    )
  })

  it('renders methodology, per-group results, trends and sandboxed artwork without any action controls', async () => {
    publicApiMocks.getIQDetectionPublicOverview.mockResolvedValue(sampleOverview())
    const wrapper = mountView()
    await flushPromises()

    const about = wrapper.get('[data-testid="iq-public-about"]')
    expect(about.text()).toContain('gpt-5.4')
    expect(about.text()).toContain('medium')
    expect(about.text()).toContain('每 12 小时')
    expect(about.text()).toContain('逻辑推理题')
    expect(about.text()).toContain('鹈鹕 SVG 动画')

    expect(wrapper.get('[data-testid="iq-public-health-10"]').text()).toContain('部分波动')
    expect(wrapper.get('[data-testid="iq-public-result-10-candy_logic"]').text()).toBe('答对 2/3')
    expect(wrapper.get('[data-testid="iq-public-result-10-pelican_svg"]').text()).toBe('88 分')

    // Untested group: neutral health, a single "awaiting first check" line, no history fetch.
    expect(wrapper.get('[data-testid="iq-public-health-20"]').text()).toContain('尚未检测')
    expect(wrapper.get('[data-testid="iq-public-unchecked-20"]').text()).toContain('还没有检测记录')
    expect(wrapper.find('[data-testid="iq-public-row-20-candy_logic"]').exists()).toBe(false)
    const fetchedGroups = publicApiMocks.listIQDetectionPublicRuns.mock.calls.map((c) => c[0].group_id)
    expect(fetchedGroups).not.toContain(20)
    expect(publicApiMocks.listIQDetectionPublicRuns).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 10, benchmark_type: 'candy_logic', page_size: 24 }),
      expect.anything()
    )

    // Trend: oldest → newest, error runs drawn full height.
    const candyBars = wrapper
      .get('[data-testid="iq-public-trend-10-candy_logic"]')
      .findAll('[data-testid="iq-public-trend-bar"]')
    expect(candyBars).toHaveLength(3)
    expect(candyBars[0].attributes('style')).toContain('height: 100%')
    expect(candyBars[2].classes()).toContain('bg-amber-500')

    // Artwork: sandboxed iframe, scripts only, never same-origin.
    const iframes = wrapper.get('[data-testid="iq-public-gallery"]').findAll('iframe')
    expect(iframes).toHaveLength(1)
    expect(iframes[0].attributes('sandbox')).toBe('allow-scripts')
    expect(iframes[0].attributes('sandbox')).not.toContain('allow-same-origin')
    expect(iframes[0].attributes('srcdoc')).toBeUndefined()

    // Only view controls exist: refresh and local animation replay.
    const allowed = new Set(['iq-public-refresh', 'iq-public-art-replay'])
    for (const btn of wrapper.findAll('button')) {
      expect(allowed.has(btn.attributes('data-testid') ?? '')).toBe(true)
    }
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('抽检全部')
    expect(wrapper.text()).not.toContain('检测配置')

    expect(useIQDetectionVisibility().iqDetectionPublic.value).toBe(true)
  })

  it('shows a calm not-public state on 403 IQ_DETECTION_NOT_PUBLIC and hides the sidebar entry', async () => {
    setIQDetectionVisibility(true)
    publicApiMocks.getIQDetectionPublicOverview.mockRejectedValue(notPublicError())
    const wrapper = mountView()
    await flushPromises()

    const disabled = wrapper.get('[data-testid="iq-public-disabled"]')
    expect(disabled.text()).toContain('检测结果暂未公开')
    expect(wrapper.find('[data-testid="iq-public-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid^="iq-public-group-"]').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toBe('/dashboard')
    expect(publicApiMocks.listIQDetectionPublicRuns).not.toHaveBeenCalled()
    expect(useIQDetectionVisibility().iqDetectionPublic.value).toBe(false)
  })

  it('switches to the not-public state when a history request is rejected mid-load', async () => {
    publicApiMocks.getIQDetectionPublicOverview.mockResolvedValue(sampleOverview())
    publicApiMocks.listIQDetectionPublicRuns.mockReset()
    publicApiMocks.listIQDetectionPublicRuns.mockRejectedValue(notPublicError())
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="iq-public-disabled"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="iq-public-gallery"]').exists()).toBe(false)
  })

  it('shows a distinct error state with retry, then recovers', async () => {
    publicApiMocks.getIQDetectionPublicOverview
      .mockRejectedValueOnce({ status: 500, message: 'upstream exploded' })
      .mockResolvedValueOnce(sampleOverview())
    const wrapper = mountView()
    await flushPromises()

    const error = wrapper.get('[data-testid="iq-public-error"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('检测结果加载失败')
    expect(wrapper.find('[data-testid="iq-public-disabled"]').exists()).toBe(false)

    await wrapper.get('[data-testid="iq-public-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="iq-public-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="iq-public-group-10"]').exists()).toBe(true)
  })

  it('shows a loading state before data arrives', async () => {
    publicApiMocks.getIQDetectionPublicOverview.mockReturnValue(new Promise(() => {}))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.get('[data-testid="iq-public-loading"]').attributes('role')).toBe('status')
  })

  it('shows the empty state when no visible group is monitored', async () => {
    publicApiMocks.getIQDetectionPublicOverview.mockResolvedValue({ ...sampleOverview(), groups: [] })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-testid="iq-public-empty"]').text()).toContain('暂无可显示的分组')
    expect(wrapper.find('[data-testid="iq-public-gallery"]').exists()).toBe(false)
    expect(publicApiMocks.listIQDetectionPublicRuns).not.toHaveBeenCalled()
  })

  it('marks a benchmark that never ran for a tested group without drawing a trend', async () => {
    const data = sampleOverview()
    data.groups[0].latest_runs_by_benchmark = { candy_logic: candyRun() }
    publicApiMocks.getIQDetectionPublicOverview.mockResolvedValue(data)
    const wrapper = mountView()
    await flushPromises()

    const row = wrapper.get('[data-testid="iq-public-row-10-pelican_svg"]')
    expect(row.text()).toContain('尚未检测')
    expect(wrapper.find('[data-testid="iq-public-trend-10-pelican_svg"]').exists()).toBe(false)
    expect(publicApiMocks.listIQDetectionPublicRuns).toHaveBeenCalledTimes(1)
    // Pelican is enabled, so the gallery explains that no artwork exists yet.
    expect(wrapper.get('[data-testid="iq-public-gallery-empty"]').exists()).toBe(true)
  })

  it('keeps the page usable when one history request fails', async () => {
    publicApiMocks.getIQDetectionPublicOverview.mockResolvedValue(sampleOverview())
    publicApiMocks.listIQDetectionPublicRuns.mockReset()
    publicApiMocks.listIQDetectionPublicRuns.mockImplementation(async (params: { benchmark_type: string }) => {
      if (params.benchmark_type === 'pelican_svg') throw { status: 500, message: 'boom' }
      return { items: [candyRun()], total: 1, page: 1, page_size: 24, pages: 1 }
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="iq-public-trend-error-10-pelican_svg"]').exists()).toBe(true)
    expect(
      wrapper.get('[data-testid="iq-public-trend-10-candy_logic"]').findAll('[data-testid="iq-public-trend-bar"]')
    ).toHaveLength(1)
  })
})

describe('IQ detection visibility cache', () => {
  beforeEach(resetAll)

  it('stays hidden until the server confirms, then caches per user', async () => {
    const { iqDetectionPublic } = useIQDetectionVisibility()
    expect(iqDetectionPublic.value).toBe(false)

    publicApiMocks.getIQDetectionVisibility.mockResolvedValue({ enabled: true })
    await refreshIQDetectionVisibility()
    expect(iqDetectionPublic.value).toBe(true)
    await refreshIQDetectionVisibility()
    expect(publicApiMocks.getIQDetectionVisibility).toHaveBeenCalledTimes(1)

    publicApiMocks.getIQDetectionVisibility.mockResolvedValue({ enabled: false })
    await refreshIQDetectionVisibility(true)
    expect(iqDetectionPublic.value).toBe(false)
  })

  it('refetches for a different signed-in user and clears when signed out', async () => {
    const { iqDetectionPublic } = useIQDetectionVisibility()
    publicApiMocks.getIQDetectionVisibility.mockResolvedValue({ enabled: true })
    await refreshIQDetectionVisibility()
    expect(publicApiMocks.getIQDetectionVisibility).toHaveBeenCalledTimes(1)

    authState.value = reactive({ isAuthenticated: true, user: { id: 8 } })
    await refreshIQDetectionVisibility()
    expect(publicApiMocks.getIQDetectionVisibility).toHaveBeenCalledTimes(2)

    authState.value = reactive({ isAuthenticated: false, user: null })
    await refreshIQDetectionVisibility()
    expect(iqDetectionPublic.value).toBe(false)
    expect(publicApiMocks.getIQDetectionVisibility).toHaveBeenCalledTimes(2)
  })

  it('treats a failed lookup as hidden and retries next time', async () => {
    const { iqDetectionPublic } = useIQDetectionVisibility()
    publicApiMocks.getIQDetectionVisibility.mockRejectedValueOnce({ status: 0 })
    await refreshIQDetectionVisibility()
    expect(iqDetectionPublic.value).toBe(false)

    publicApiMocks.getIQDetectionVisibility.mockResolvedValueOnce({ enabled: true })
    await refreshIQDetectionVisibility()
    expect(iqDetectionPublic.value).toBe(true)
  })

  it('recognises the not-public rejection shape', () => {
    expect(isIQDetectionNotPublicError(notPublicError())).toBe(true)
    expect(isIQDetectionNotPublicError({ status: 403, reason: 'IQ_DETECTION_GROUP_NOT_VISIBLE' })).toBe(false)
    expect(isIQDetectionNotPublicError({ status: 500 })).toBe(false)
  })
})

describe('public view helpers', () => {
  it('derives scores per benchmark and orders benchmarks canonically', () => {
    expect(resolvePublicRunScore(candyRun({ graded_count: 4, correct_count: 3 }))).toBe(75)
    expect(resolvePublicRunScore(candyRun({ graded_count: 0 }))).toBeNull()
    expect(resolvePublicRunScore(pelicanRun({ avg_score: null }))).toBe(88)
    expect(
      resolvePublicBenchmarks({
        benchmark_types: ['pelican_svg', 'unknown'],
        groups: [{ ...sampleOverview().groups[0] }]
      })
    ).toEqual(['candy_logic', 'pelican_svg'])
  })
})

describe('Admin "visible to users" switch', () => {
  beforeEach(() => {
    resetAll()
    authState.value = null
    adminApiMocks.fetchAllOpenAIGroups.mockResolvedValue([])
    adminApiMocks.updateIQDetectionConfig.mockImplementation(async (cfg: IQDetectionConfig) => ({
      ...cfg,
      version: cfg.version + 1
    }))
  })

  const baseConfig = (): IQDetectionConfig => ({
    version: 3,
    enabled: false,
    interval_minutes: 720,
    group_ids: [10],
    model: 'gpt-5.4',
    reasoning_effort: 'medium',
    tests_per_group: 1,
    last_scheduled_at: null,
    updated_at: '2026-11-15T08:00:00Z',
    updated_by: 1,
    builtin_prompt: 'prompt'
  })

  it('defaults off when the field is missing and shows the /iq-detection link only after saving user_visible=true', async () => {
    const wrapper = mount(IQDetectionSettingsPanel, {
      props: { initialConfig: baseConfig() },
      global: { stubs: { RouterLink: RouterLinkStub } }
    })
    await flushPromises()

    const toggle = wrapper.get('[data-testid="iq-user-visible-toggle"]')
    expect(toggle.attributes('aria-checked')).toBe('false')
    expect(wrapper.get('[data-testid="iq-user-visible-section"]').text()).toContain('对用户公开')
    expect(wrapper.find('[data-testid="iq-user-visible-link"]').exists()).toBe(false)

    // Toggling without saving must not show the link yet.
    await toggle.trigger('click')
    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-testid="iq-user-visible-link"]').exists()).toBe(false)

    await wrapper.get('[data-testid="iq-save-config-btn"]').trigger('click')
    await flushPromises()

    expect(adminApiMocks.updateIQDetectionConfig).toHaveBeenCalledTimes(1)
    expect((adminApiMocks.updateIQDetectionConfig.mock.calls[0][0] as IQDetectionConfig).user_visible).toBe(true)

    const link = wrapper.get('[data-testid="iq-user-visible-link"]')
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toBe('/iq-detection')
    expect(link.text()).toContain('打开用户页面')
    expect(wrapper.get('[data-testid="iq-user-visible-section"]').text()).toContain('/iq-detection')
  })

  it('reflects a saved user_visible=true from the server with the user-page link and hides it after saving off', async () => {
    const wrapper = mount(IQDetectionSettingsPanel, {
      props: { initialConfig: { ...baseConfig(), user_visible: true } },
      global: { stubs: { RouterLink: RouterLinkStub } }
    })
    await flushPromises()
    expect(wrapper.get('[data-testid="iq-user-visible-toggle"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-testid="iq-user-visible-link"]').exists()).toBe(true)
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toBe('/iq-detection')

    await wrapper.get('[data-testid="iq-user-visible-toggle"]').trigger('click')
    await wrapper.get('[data-testid="iq-save-config-btn"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="iq-user-visible-link"]').exists()).toBe(false)
  })
})

describe('public i18n parity', () => {
  const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]
    )

  it('has identical zh/en keys for iqDetection.public and the admin switch', () => {
    const zhPublic = flatten((zh as any).iqDetection.public).sort()
    const enPublic = flatten((en as any).iqDetection.public).sort()
    expect(zhPublic.length).toBeGreaterThan(30)
    expect(enPublic).toEqual(zhPublic)
    for (const key of [
      'userVisibleSectionTitle',
      'userVisibleSectionHint',
      'userVisibleLabel',
      'userVisibleOpenLink'
    ]) {
      expect((zh as any).iqDetection.settings[key]).toBeTruthy()
      expect((en as any).iqDetection.settings[key]).toBeTruthy()
    }
  })
})
