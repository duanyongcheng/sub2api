import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import en from '@/i18n/locales/en'
import zh from '@/i18n/locales/zh'
import { routes } from '@/router'
import type {
  IQDetectionConfig,
  IQDetectionOverview,
  IQDetectionRun
} from '../types'
import IQDetectionView from '../IQDetectionView.vue'
import IQDetectionSettingsPanel from '../IQDetectionSettingsPanel.vue'
import {
  buildSandboxedPelicanSrcdoc,
  getPelicanSandboxUrl,
  PELICAN_SANDBOX_CSP,
  PELICAN_SANDBOX_READY_EVENT,
  PELICAN_SANDBOX_RENDER_EVENT
} from '../sandboxHtml'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path: string) => readFileSync(resolve(here, path), 'utf8')

const apiMocks = vi.hoisted(() => ({
  getIQDetectionConfig: vi.fn(),
  updateIQDetectionConfig: vi.fn(),
  getIQDetectionOverview: vi.fn(),
  listIQDetectionRuns: vi.fn(),
  runIQDetectionNow: vi.fn(),
  fetchAllOpenAIGroups: vi.fn()
}))

const storeMocks = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn()
}))

const routerMocks = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  replace: vi.fn(() => Promise.resolve())
}))

vi.mock('../api', () => apiMocks)

vi.mock('@/stores/app', () => ({
  useAppStore: () => storeMocks
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => ({ query: routerMocks.query }),
    useRouter: () => ({ replace: routerMocks.replace })
  }
})

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

const sampleConfig = (): IQDetectionConfig => ({
  version: 2,
  enabled: false,
  interval_minutes: 720,
  group_ids: [10],
  model: 'gpt-5.4',
  reasoning_effort: 'medium',
  tests_per_group: 1,
  last_scheduled_at: null,
  updated_at: '2026-11-15T08:00:00Z',
  updated_by: 1,
  builtin_prompt: '黑袋摸糖题原文'
})

const sampleRun = (): IQDetectionRun => ({
  id: 901,
  group_id: 10,
  group_name: 'Codex Pro Pool',
  platform: 'openai',
  trigger_type: 'manual',
  requested_model: 'gpt-5.4',
  reasoning_effort: 'medium',
  tests_count: 1,
  graded_count: 1,
  correct_count: 1,
  verdict: 'normal',
  avg_input_tokens: 185,
  avg_output_tokens: 550,
  avg_reasoning_tokens: 516,
  avg_latency_ms: 4200,
  avg_tps: 131.0,
  response_model: 'gpt-5.4-2026',
  answer_preview: '最少需要取出 21 个糖果。',
  error_message: '',
  samples: [
    {
      run_index: 1,
      account_id: 77,
      account_name: 'codex-team-01',
      account_type: 'oauth',
      protocol: 'codex_oauth_responses',
      ok: true,
      graded: true,
      input_tokens: 185,
      output_tokens: 550,
      reasoning_tokens: 516,
      latency_ms: 4200,
      tps: 131.0,
      response_model: 'gpt-5.4-2026',
      answer_text: '最少需要取出 21 个糖果。'
    }
  ],
  started_at: '2026-11-15T08:10:00Z',
  completed_at: '2026-11-15T08:10:04Z',
  created_at: '2026-11-15T08:10:04Z'
})

const sampleOverview = (): IQDetectionOverview => ({
  config: sampleConfig(),
  summary: {
    configured_count: 1,
    tested_count: 1,
    normal_count: 1,
    warning_count: 0,
    degraded_count: 0,
    error_count: 0,
    untested_count: 0
  },
  groups: [
    {
      group_id: 10,
      group_name: 'Codex Pro Pool',
      platform: 'openai',
      group_status: 'active',
      schedulable_account_count: 4,
      in_flight: false,
      latest_run: sampleRun()
    }
  ]
})

const AppLayoutStub = { template: '<div data-testid="app-layout"><slot /></div>' }
const BaseDialogStub = {
  props: ['show', 'title', 'width'],
  emits: ['close'],
  template: '<div v-if="show" data-testid="detail-dialog"><h3>{{ title }}</h3><slot /><slot name="footer" /></div>'
}

describe('IQ Detection admin-only integration surface', () => {
  it('registers /admin/iq-detection with requiresAuth and requiresAdmin', () => {
    const matched = routes.find((r) => r.path === '/admin/iq-detection')
    expect(matched).toBeDefined()
    expect(matched?.meta).toMatchObject({
      requiresAuth: true,
      requiresAdmin: true
    })
  })

  it('mounts /admin/iq-detection only in adminNavGroups and never in userNavGroups', () => {
    const sidebar = read('../../../components/layout/AppSidebar.vue')
    const userStart = sidebar.indexOf('const userNavGroups = computed')
    const adminStart = sidebar.indexOf('const adminNavGroups = computed')
    expect(userStart).toBeGreaterThan(-1)
    expect(adminStart).toBeGreaterThan(userStart)

    const userSection = sidebar.slice(userStart, adminStart)
    const adminSection = sidebar.slice(adminStart)

    expect(userSection).not.toContain('/admin/iq-detection')
    expect(userSection).not.toContain('nav.iqDetection')
    expect(adminSection).toContain("path: '/admin/iq-detection'")
    expect(adminSection).toContain("t('nav.iqDetection')")
  })

  it('maintains symmetric zh/en i18n keys for iqDetection and nav.iqDetection', () => {
    expect(zh.nav.iqDetection).toBe('智商检测')
    expect(en.nav.iqDetection).toBe('IQ Detection')
    expect(Object.keys(zh.iqDetection)).toEqual(Object.keys(en.iqDetection))
  })
})

describe('IQDetectionView', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((fn) => fn.mockReset())
    Object.values(storeMocks).forEach((fn) => fn.mockReset())
    routerMocks.query = {}
    routerMocks.replace.mockClear()

    apiMocks.getIQDetectionOverview.mockResolvedValue(sampleOverview())
    apiMocks.listIQDetectionRuns.mockResolvedValue({
      items: [sampleRun()],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1
    })
    apiMocks.runIQDetectionNow.mockResolvedValue({
      requested_groups: 1,
      executed_groups: 1,
      skipped_in_flight_groups: [],
      runs: [sampleRun()]
    })
  })

  function mountView() {
    return mount(IQDetectionView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          BaseDialog: BaseDialogStub
        }
      }
    })
  }

  it('loads overview and runs, displays reasoning telemetry without truncation warning, and triggers single/all group probes', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(apiMocks.getIQDetectionOverview).toHaveBeenCalledTimes(1)
    expect(apiMocks.listIQDetectionRuns).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Codex Pro Pool')
    expect(wrapper.text()).toContain('516')
    expect(wrapper.text()).toContain('智商正常')
    expect(wrapper.text()).not.toContain('518n-2')

    // Trigger single group probe (explicitly sends selected benchmark_type)
    await wrapper.get('[data-testid="iq-run-group-10"]').trigger('click')
    await flushPromises()
    expect(apiMocks.runIQDetectionNow).toHaveBeenCalledWith({
      group_ids: [10],
      benchmark_type: 'candy_logic'
    })
    expect(storeMocks.showSuccess).toHaveBeenCalled()

    // Open detail modal and verify reasoning_tokens telemetry is shown without truncation badge
    await wrapper.get('[data-testid="iq-group-detail-10"]').trigger('click')
    await flushPromises()
    const detailText = wrapper.get('[data-testid="detail-dialog"]').text()
    expect(detailText).toContain('185 / 550 / 516')
    expect(detailText).toContain('答对 (21)')
    expect(detailText).not.toContain('518n-2')

    // Trigger run-all (explicitly sends selected benchmark_type)
    await wrapper.get('[data-testid="iq-run-all-btn"]').trigger('click')
    await flushPromises()
    expect(apiMocks.runIQDetectionNow).toHaveBeenLastCalledWith({
      benchmark_type: 'candy_logic'
    })
  })

  it('surfaces benchmark mismatch bar, shows empty Pelican gallery, and runs pelican_svg explicitly when configured', async () => {
    apiMocks.getIQDetectionOverview.mockResolvedValue({
      ...sampleOverview(),
      config: {
        ...sampleConfig(),
        enabled: true,
        interval_minutes: 30,
        benchmark_type: 'pelican_svg'
      },
      groups: [
        {
          ...sampleOverview().groups[0],
          latest_run: {
            ...sampleRun(),
            trigger_type: 'scheduled',
            benchmark_type: 'candy_logic'
          }
        }
      ]
    })
    apiMocks.listIQDetectionRuns.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      pages: 0
    })

    const wrapper = mountView()
    await flushPromises()

    // Syncs manual benchmark select to configured pelican_svg automatically
    const benchSelect = wrapper.get('[data-testid="iq-run-benchmark-select"]')
    expect(benchSelect.attributes('data-value')).toBe('pelican_svg')
    expect(benchSelect.text()).toContain('鹈鹕 SVG 动画')

    // Surfaces mismatch triage bar & empty Pelican gallery stage
    expect(wrapper.find('[data-testid="iq-benchmark-mismatch-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="iq-pelican-empty"]').exists()).toBe(true)

    // Clicking sync CTA sends benchmark_type: 'pelican_svg' explicitly
    await wrapper.get('[data-testid="iq-sync-benchmark-run-btn"]').trigger('click')
    await flushPromises()
    expect(apiMocks.runIQDetectionNow).toHaveBeenCalledWith({
      benchmark_type: 'pelican_svg'
    })
  })

  it('shows empty state CTA and switches to settings when no groups are configured', async () => {
    apiMocks.getIQDetectionOverview.mockResolvedValue({
      config: { ...sampleConfig(), group_ids: [] },
      summary: {
        configured_count: 0,
        tested_count: 0,
        normal_count: 0,
        warning_count: 0,
        degraded_count: 0,
        error_count: 0,
        untested_count: 0
      },
      groups: []
    })
    apiMocks.listIQDetectionRuns.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      pages: 0
    })
    apiMocks.fetchAllOpenAIGroups.mockResolvedValue([])
    apiMocks.getIQDetectionConfig.mockResolvedValue({ ...sampleConfig(), group_ids: [] })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="iq-empty-groups"]').exists()).toBe(true)
    await wrapper.get('[data-testid="iq-goto-settings-btn"]').trigger('click')
    await flushPromises()

    expect(routerMocks.replace).toHaveBeenCalledWith({ query: { tab: 'settings' } })
  })

  it('displays scheduled patrol badge for 30-minute and 1-hour intervals', async () => {
    apiMocks.getIQDetectionOverview.mockResolvedValue({
      ...sampleOverview(),
      config: { ...sampleConfig(), enabled: true, interval_minutes: 30 }
    })

    const wrapper30 = mountView()
    await flushPromises()
    expect(wrapper30.text()).toContain('定时巡检已开启（每 30 分钟）')

    apiMocks.getIQDetectionOverview.mockResolvedValue({
      ...sampleOverview(),
      config: { ...sampleConfig(), enabled: true, interval_minutes: 60 }
    })

    const wrapper60 = mountView()
    await flushPromises()
    expect(wrapper60.text()).toContain('定时巡检已开启（每 1 小时）')
  })
})

describe('IQDetectionSettingsPanel', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((fn) => fn.mockReset())
    Object.values(storeMocks).forEach((fn) => fn.mockReset())

    apiMocks.fetchAllOpenAIGroups.mockResolvedValue([
      {
        id: 10,
        name: 'Codex Pro Pool',
        platform: 'openai',
        status: 'active',
        account_count: 5,
        active_account_count: 4
      },
      {
        id: 15,
        name: 'Codex Team Pool',
        platform: 'openai',
        status: 'active',
        account_count: 3,
        active_account_count: 3
      }
    ])
    apiMocks.updateIQDetectionConfig.mockImplementation(async (cfg: IQDetectionConfig) => ({
      ...cfg,
      version: cfg.version + 1
    }))
  })

  it('loads OpenAI group catalog, selects active groups, and saves updated config', async () => {
    const wrapper = mount(IQDetectionSettingsPanel, {
      props: {
        initialConfig: { ...sampleConfig(), group_ids: [10] }
      }
    })
    await flushPromises()

    expect(apiMocks.fetchAllOpenAIGroups).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Codex Pro Pool')
    expect(wrapper.text()).toContain('Codex Team Pool')

    await wrapper.get('[data-testid="iq-select-active-groups-btn"]').trigger('click')
    await wrapper.get('[data-testid="iq-save-config-btn"]').trigger('click')
    await flushPromises()

    expect(apiMocks.updateIQDetectionConfig).toHaveBeenCalledTimes(1)
    const submitted = apiMocks.updateIQDetectionConfig.mock.calls[0][0] as IQDetectionConfig
    expect(submitted.group_ids).toEqual([10, 15])
    expect(storeMocks.showSuccess).toHaveBeenCalled()
  })

  it('renders 30m and 1h patrol interval options and persists selected frequencies', async () => {
    const wrapper = mount(IQDetectionSettingsPanel, {
      props: {
        initialConfig: { ...sampleConfig(), group_ids: [10], interval_minutes: 720 }
      }
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="iq-interval-opt-30"]').text()).toBe('每 30 分钟')
    expect(wrapper.get('[data-testid="iq-interval-opt-60"]').text()).toBe('每 1 小时')
    expect(wrapper.get('[data-testid="iq-interval-opt-360"]').text()).toBe('每 6 小时')
    expect(wrapper.get('[data-testid="iq-interval-opt-720"]').text()).toBe('每 12 小时')
    expect(wrapper.get('[data-testid="iq-interval-opt-1440"]').text()).toBe('每 24 小时')

    // Select 30 minutes and save
    await wrapper.get('[data-testid="iq-interval-opt-30"]').trigger('click')
    await wrapper.get('[data-testid="iq-save-config-btn"]').trigger('click')
    await flushPromises()

    expect(apiMocks.updateIQDetectionConfig).toHaveBeenCalledTimes(1)
    expect((apiMocks.updateIQDetectionConfig.mock.calls[0][0] as IQDetectionConfig).interval_minutes).toBe(30)

    // Select 1 hour (60 minutes) and save
    await wrapper.get('[data-testid="iq-interval-opt-60"]').trigger('click')
    await wrapper.get('[data-testid="iq-save-config-btn"]').trigger('click')
    await flushPromises()

    expect(apiMocks.updateIQDetectionConfig).toHaveBeenCalledTimes(2)
    expect((apiMocks.updateIQDetectionConfig.mock.calls[1][0] as IQDetectionConfig).interval_minutes).toBe(60)
  })

  it('supports enabling both benchmarks simultaneously and narrowing to pelican_svg with fixed 1x/group note', async () => {
    const wrapper = mount(IQDetectionSettingsPanel, {
      props: {
        initialConfig: {
          ...sampleConfig(),
          benchmark_type: 'candy_logic',
          benchmark_types: ['candy_logic'],
          tests_per_group: 3,
          builtin_prompts: {
            candy_logic: '黑袋摸糖题原文',
            pelican_svg: '创建一个html，内容是SVG绘制一个鹈鹕骑自行车的2D动画，不要联网，不要参考其他文件。'
          }
        }
      }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('固定 1 轮/组')

    // Click pelican_svg -> enables BOTH candy_logic + pelican_svg simultaneously
    await wrapper.get('[data-testid="iq-benchmark-opt-pelican_svg"]').trigger('click')
    expect(wrapper.text()).toContain('结构与动画综合打分')

    await wrapper.get('[data-testid="iq-save-config-btn"]').trigger('click')
    await flushPromises()

    expect(apiMocks.updateIQDetectionConfig).toHaveBeenCalledTimes(1)
    const dualSubmitted = apiMocks.updateIQDetectionConfig.mock.calls[0][0] as IQDetectionConfig
    expect(dualSubmitted.benchmark_types).toEqual(['candy_logic', 'pelican_svg'])
    expect(dualSubmitted.benchmark_type).toBe('candy_logic')

    // Uncheck candy_logic -> narrows to pelican_svg only and displays fixed 1x/group note
    await wrapper.get('[data-testid="iq-benchmark-opt-candy_logic"]').trigger('click')
    expect(wrapper.text()).toContain('固定执行 1 轮 / 组')

    await wrapper.get('[data-testid="iq-save-config-btn"]').trigger('click')
    await flushPromises()

    expect(apiMocks.updateIQDetectionConfig).toHaveBeenCalledTimes(2)
    const pelicanOnly = apiMocks.updateIQDetectionConfig.mock.calls[1][0] as IQDetectionConfig
    expect(pelicanOnly.benchmark_types).toEqual(['pelican_svg'])
    expect(pelicanOnly.benchmark_type).toBe('pelican_svg')
  })
})

describe('Pelican SVG benchmark sandbox, gallery, and manual override', () => {
  const samplePelicanRun = (): IQDetectionRun => ({
    ...sampleRun(),
    id: 950,
    benchmark_type: 'pelican_svg',
    avg_score: 92,
    verdict: 'normal',
    answer_preview: '结构评分 92/100 · 40 图元 · 18 曲线 · 3 组动画 · 双轮已检出',
    samples: [
      {
        run_index: 1,
        account_id: 77,
        account_name: 'codex-team-01',
        account_type: 'oauth',
        protocol: 'codex_oauth_responses',
        ok: true,
        graded: true,
        score: 92,
        input_tokens: 90,
        output_tokens: 2400,
        reasoning_tokens: 1100,
        latency_ms: 18500,
        tps: 129.7,
        response_model: 'gpt-5.4-2026',
        answer_text: '结构评分 92/100 · 40 图元 · 18 曲线 · 3 组动画 · 双轮已检出',
        artifact_html:
          '<!DOCTYPE html><html><head><base href="https://evil.example/"><title>Pelican</title></head><body><svg viewBox="0 0 800 500"><circle cx="240" cy="340" r="60"/><circle cx="520" cy="340" r="60"/></svg></body></html>',
        pelican_eval: {
          score: 92,
          has_complete_html: true,
          has_svg: true,
          has_view_box: true,
          offline_compliant: true,
          primitive_count: 40,
          path_count: 16,
          curve_command_count: 18,
          group_count: 7,
          unique_color_count: 8,
          has_animation: true,
          animation_driver_count: 3,
          wheel_pair_detected: true,
          semantic_parts_detected: ['beak_pouch', 'bike_frame', 'pedal_crank', 'pelican', 'wing_body']
        }
      }
    ]
  })

  beforeEach(() => {
    Object.values(apiMocks).forEach((fn) => fn.mockReset())
    Object.values(storeMocks).forEach((fn) => fn.mockReset())
    routerMocks.query = {}

    const pelicanRun = samplePelicanRun()
    apiMocks.getIQDetectionOverview.mockResolvedValue({
      ...sampleOverview(),
      groups: [
        {
          ...sampleOverview().groups[0],
          latest_run: pelicanRun
        }
      ]
    })
    apiMocks.listIQDetectionRuns.mockResolvedValue({
      items: [pelicanRun],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1
    })
    apiMocks.runIQDetectionNow.mockResolvedValue({
      requested_groups: 1,
      executed_groups: 1,
      skipped_in_flight_groups: [],
      runs: [pelicanRun]
    })
  })

  it('injects strict offline CSP, late-cascade stage styles, viewport fitter, and strips base tags', () => {
    const srcdoc = buildSandboxedPelicanSrcdoc(
      '<!DOCTYPE html><html><head><base href="https://evil.test/"><title>T</title><style>svg{width:100%;height:auto;}</style></head><body><svg viewBox="0 0 100 100"></svg></body></html>'
    )
    expect(srcdoc).toContain(PELICAN_SANDBOX_CSP)
    expect(srcdoc).not.toContain('<base')
    expect(srcdoc).toContain('data-iq-stage')
    expect(srcdoc).toContain('data-iq-stage-fit')
    // Guard stage styles and fit script must be injected AFTER model <style> and before </head>
    const modelStylePos = srcdoc.indexOf('svg{width:100%;height:auto;}')
    const guardStylePos = srcdoc.indexOf('data-iq-stage>')
    const headClosePos = srcdoc.indexOf('</head>')
    expect(modelStylePos).toBeGreaterThan(-1)
    expect(guardStylePos).toBeGreaterThan(modelStylePos)
    expect(guardStylePos).toBeLessThan(headClosePos)
  })

  it('renders isolated sandboxed Pelican gallery via dedicated sandbox URL, delivers HTML over postMessage, opens detail preview/source, and supports quick benchmark override', async () => {
    const wrapper = mount(IQDetectionView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          BaseDialog: BaseDialogStub
        }
      }
    })
    await flushPromises()

    const gallery = wrapper.get('[data-testid="iq-pelican-gallery"]')
    expect(gallery.text()).toContain('92 分')
    expect(gallery.text()).toContain('40 图元')
    expect(gallery.text()).toContain('3 组动画')
    expect(gallery.text()).toContain('双轮 ✓')

    // Strictly verify sandbox has allow-scripts ONLY, NEVER allow-same-origin, and loads dedicated
    // sandbox host URL instead of srcdoc (avoiding parent nonce-CSP inheritance blocking inline scripts)
    const iframe = gallery.get('iframe')
    expect(iframe.attributes('sandbox')).toBe('allow-scripts')
    expect(iframe.attributes('sandbox')).not.toContain('allow-same-origin')
    expect(iframe.attributes('referrerpolicy')).toBe('no-referrer')
    expect(iframe.attributes('src')).toBe(getPelicanSandboxUrl())
    expect(iframe.attributes('srcdoc')).toBeUndefined()

    // Simulate sandbox host ready handshake -> parent posts compiled offline HTML exactly once
    const mockContentWindow = { postMessage: vi.fn() }
    Object.defineProperty(iframe.element, 'contentWindow', {
      configurable: true,
      value: mockContentWindow
    })
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: PELICAN_SANDBOX_READY_EVENT },
        source: mockContentWindow as unknown as MessageEventSource
      })
    )
    expect(mockContentWindow.postMessage).toHaveBeenCalledTimes(1)
    const [postedPayload, targetOrigin] = mockContentWindow.postMessage.mock.calls[0]
    expect(targetOrigin).toBe('*')
    expect(postedPayload.type).toBe(PELICAN_SANDBOX_RENDER_EVENT)
    expect(postedPayload.html).toContain(PELICAN_SANDBOX_CSP)
    expect(postedPayload.html).toContain('data-iq-stage-fit')
    expect(postedPayload.html).not.toContain('<base')

    // Subsequent iframe load event does not double-deliver
    await iframe.trigger('load')
    expect(mockContentWindow.postMessage).toHaveBeenCalledTimes(1)

    // Inspect gallery item -> detail stage preview & source toggle
    await wrapper.get('[data-testid="iq-pelican-inspect-10"]').trigger('click')
    await flushPromises()
    const stage = wrapper.get('[data-testid="iq-pelican-detail-stage"]')
    expect(stage.get('iframe').attributes('sandbox')).toBe('allow-scripts')
    expect(stage.get('iframe').attributes('src')).toBe(getPelicanSandboxUrl())
    expect(stage.get('iframe').attributes('srcdoc')).toBeUndefined()
    await wrapper.get('[data-testid="iq-pelican-mode-source"]').trigger('click')
    expect(wrapper.get('[data-testid="iq-pelican-source-code"]').text()).toContain('<svg viewBox="0 0 800 500">')

    // Override manual benchmark selector to pelican_svg via custom Select popover and trigger run-all
    const benchSelect = wrapper.get('[data-testid="iq-run-benchmark-select"]')
    await benchSelect.get('.select-trigger').trigger('click')
    await flushPromises()
    const pelicanOpt = document.body.querySelector<HTMLElement>(
      '.select-dropdown-portal [data-option-value="pelican_svg"]'
    )
    expect(pelicanOpt).not.toBeNull()
    pelicanOpt!.click()
    await flushPromises()
    expect(benchSelect.attributes('data-value')).toBe('pelican_svg')

    await wrapper.get('[data-testid="iq-run-all-btn"]').trigger('click')
    await flushPromises()
    expect(apiMocks.runIQDetectionNow).toHaveBeenCalledWith({ benchmark_type: 'pelican_svg' })
    wrapper.unmount()
  })

  it('renders side-by-side Candy + Pelican cells + gallery and dispatches benchmark_types when both are enabled', async () => {
    const candyRun: IQDetectionRun = {
      ...sampleRun(),
      id: 960,
      benchmark_type: 'candy_logic',
      tests_count: 2,
      graded_count: 2,
      correct_count: 2
    }
    const pelicanRun = samplePelicanRun()

    apiMocks.getIQDetectionOverview.mockResolvedValue({
      ...sampleOverview(),
      config: {
        ...sampleConfig(),
        tests_per_group: 2,
        benchmark_type: 'candy_logic',
        benchmark_types: ['candy_logic', 'pelican_svg']
      },
      groups: [
        {
          ...sampleOverview().groups[0],
          // Even when candy_logic completed after pelican_svg (latest_run = candy_logic),
          // latest_runs_by_benchmark preserves both for side-by-side display & Pelican gallery.
          latest_run: candyRun,
          latest_runs_by_benchmark: {
            candy_logic: candyRun,
            pelican_svg: pelicanRun
          }
        }
      ]
    })

    const wrapper = mount(IQDetectionView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          BaseDialog: BaseDialogStub
        }
      }
    })
    await flushPromises()

    // Top bar pills show Candy (2 轮/组) and Pelican (1 轮/组), and manual select defaults to 'both'
    expect(wrapper.text()).toContain('2 轮/组')
    expect(wrapper.text()).toContain('1 轮/组')
    const benchSelect = wrapper.get('[data-testid="iq-run-benchmark-select"]')
    expect(benchSelect.attributes('data-value')).toBe('both')
    expect(benchSelect.text()).toContain('双题型同步抽检')

    // Side-by-side table cells render both Candy accuracy (2/2) and Pelican score (92 分)
    expect(wrapper.get('[data-testid="iq-group-candy-detail-10"]').text()).toContain('2/2')
    expect(wrapper.get('[data-testid="iq-group-pelican-detail-10"]').text()).toContain('92 分')
    // Pelican gallery renders from latest_runs_by_benchmark.pelican_svg even though latest_run is candy_logic
    expect(wrapper.get('[data-testid="iq-pelican-gallery"]').text()).toContain('92 分')

    // Custom history filter Select triggers reload and reveals reset button
    const verdictSelect = wrapper.get('[data-testid="iq-history-verdict-filter"]')
    await verdictSelect.get('.select-trigger').trigger('click')
    await flushPromises()
    const warnOpt = document.body.querySelector<HTMLElement>(
      '.select-dropdown-portal [data-option-value="warning"]'
    )
    expect(warnOpt).not.toBeNull()
    warnOpt!.click()
    await flushPromises()
    expect(apiMocks.listIQDetectionRuns).toHaveBeenLastCalledWith(
      expect.objectContaining({ verdict: 'warning' }),
      expect.anything()
    )
    expect(wrapper.find('[data-testid="iq-history-reset-filters"]').exists()).toBe(true)

    // Clicking Run All in dual mode sends benchmark_types: ['candy_logic', 'pelican_svg']
    await wrapper.get('[data-testid="iq-run-all-btn"]').trigger('click')
    await flushPromises()
    expect(apiMocks.runIQDetectionNow).toHaveBeenCalledWith({
      benchmark_types: ['candy_logic', 'pelican_svg']
    })
    wrapper.unmount()
  })
})
