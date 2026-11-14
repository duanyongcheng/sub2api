import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Select from '@/components/common/Select.vue'
import MonitorSettingsPanel from '../MonitorSettingsPanel.vue'
import { CONCRETE_PLATFORM_OPTIONS } from '@/constants/platforms'
import type { MonitorConfig } from '@/api/channelMonitorV2'

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  getSnapshot: vi.fn(),
  updateConfig: vi.fn(),
  groups: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))
vi.mock('@/api/channelMonitorV2', () => ({
  getConfig: mocks.getConfig,
  getSnapshot: mocks.getSnapshot,
  updateConfig: mocks.updateConfig,
  MONITOR_ERROR_CATEGORIES: ['authentication', 'network'],
}))
vi.mock('@/api/admin', () => ({ adminAPI: { groups: { getAllIncludingInactive: mocks.groups } } }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({
  cachedPublicSettings: { channel_monitor_enabled: true },
  showError: mocks.showError,
  showSuccess: mocks.showSuccess,
}) }))
vi.mock('@/utils/featureFlags', () => ({
  getChannelMonitorMode: () => 'v2',
  isChannelMonitorV2Mode: () => true,
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

function config(): MonitorConfig {
  return {
    version: 2,
    enabled: true,
    refresh_interval_seconds: 60,
    platforms: [
      { platform: 'openai', enabled: false, models: ['gpt-4'] },
      { platform: 'custom-provider', enabled: true, models: ['custom-model'] },
    ],
    group_ids: [42],
    ignored_error_categories: [],
    health_thresholds: {
      minimum_sample: 70, warning_error_rate: 0.1, critical_error_rate: 0.3,
      target_ttft_ms: 1500, warning_ttft_ms: 2000, critical_ttft_ms: 5000,
      warning_cache_rate: 0.7, critical_cache_rate: 0.4,
      error_weight: 0.5, ttft_weight: 0.3, cache_weight: 0.2,
    },
  }
}

async function panel(value = config()) {
  mocks.getConfig.mockResolvedValue(value)
  const wrapper = mount(MonitorSettingsPanel, { global: { stubs: { RouterLink: true, teleport: true } } })
  await flushPromises()
  return wrapper
}

function button(wrapper: Awaited<ReturnType<typeof panel>>, key: string) {
  return wrapper.findAll('button').find((item) => item.text() === 'channelMonitorV2.settings.' + key)!
}

async function add(wrapper: Awaited<ReturnType<typeof panel>>, platform: string) {
  wrapper.findComponent(Select).vm.$emit('update:modelValue', platform)
  await flushPromises()
  await button(wrapper, 'addPlatform').trigger('click')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSnapshot.mockResolvedValue(null)
  mocks.groups.mockResolvedValue([])
  mocks.updateConfig.mockImplementation(async (value) => JSON.parse(JSON.stringify(value)))
})

describe('MonitorSettingsPanel platform configuration', () => {
  it('adds a missing provider and saves its models without changing existing settings', async () => {
    const original = config()
    const wrapper = await panel(original)
    expect(button(wrapper, 'save').attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent(Select).props('options')).not.toContainEqual(expect.objectContaining({ value: 'openai' }))

    await wrapper.findComponent(Select).find('button').trigger('click')
    const option = wrapper.findAll('[role="option"]').find((item) => item.text() === 'DeepSeek')!
    await option.trigger('click')
    await button(wrapper, 'addPlatform').trigger('click')
    expect(button(wrapper, 'addPlatform').attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent(Select).props('options')).not.toContainEqual(
      expect.objectContaining({ value: 'deepseek' })
    )
    const models = wrapper.findAll('input[type="text"]').at(-1)!
    await models.setValue(' deepseek-chat, deepseek-reasoner, deepseek-chat ')
    await button(wrapper, 'save').trigger('click')
    await flushPromises()

    expect(mocks.updateConfig).toHaveBeenCalledWith({
      ...original,
      platforms: [...original.platforms, {
        platform: 'deepseek', enabled: true, models: ['deepseek-chat', 'deepseek-reasoner'],
      }],
    })
    expect(button(wrapper, 'save').attributes('disabled')).toBeDefined()
    expect(original.platforms).toHaveLength(2)

    const persisted = mocks.updateConfig.mock.results[0].value
    wrapper.unmount()
    const reloaded = await panel(await persisted)
    expect((reloaded.findAll('input[type="text"]').at(-1)!.element as HTMLInputElement).value).toBe('deepseek-chat, deepseek-reasoner')
    expect(reloaded.findComponent(Select).props('options')).not.toContainEqual(
      expect.objectContaining({ value: 'deepseek' })
    )
    reloaded.unmount()
  })

  it('adds all missing providers without enabling disabled entries or changing model/group scope', async () => {
    const original = config()
    const wrapper = await panel(original)
    const addAll = wrapper.findAll('button').find(item => item.text() === 'channelMonitorV2.availability.addMissingProviders')!
    await addAll.trigger('click')
    await button(wrapper, 'save').trigger('click')
    await flushPromises()
    const saved = mocks.updateConfig.mock.calls[0][0]
    expect(saved.platforms).toEqual(expect.arrayContaining(original.platforms))
    for (const provider of ['deepseek', 'kimi', 'zhipu', 'minimax']) {
      expect(saved.platforms).toContainEqual({ platform: provider, enabled: true, models: [] })
    }
    expect(saved.platforms.filter((p: { platform: string }) => p.platform === 'openai')).toEqual([original.platforms[0]])
    expect(saved.group_ids).toEqual([42])
    expect(saved.ignored_error_categories).toEqual([])
    expect(original.platforms).toHaveLength(2)
    wrapper.unmount()
  })

  it('can start with no configured platforms and rejects duplicate additions', async () => {
    const wrapper = await panel({ ...config(), platforms: [] })
    expect(button(wrapper, 'addPlatform').attributes('disabled')).toBeDefined()
    await add(wrapper, 'kimi')
    await add(wrapper, 'kimi')
    await button(wrapper, 'save').trigger('click')
    await flushPromises()
    expect(mocks.updateConfig.mock.calls[0][0].platforms).toEqual([
      { platform: 'kimi', enabled: true, models: [] },
    ])
    wrapper.unmount()
  })

  it('restores the server config and available options when saving fails', async () => {
    const wrapper = await panel()
    mocks.updateConfig.mockRejectedValueOnce(new Error('save failed'))
    await add(wrapper, 'minimax')
    await button(wrapper, 'save').trigger('click')
    await flushPromises()
    expect(mocks.showError).toHaveBeenCalledOnce()
    expect(wrapper.findComponent(Select).props('options')).toContainEqual(
      expect.objectContaining({ value: 'minimax' })
    )
    expect(wrapper.findAll('input[type="text"]')).toHaveLength(2)
    expect(button(wrapper, 'save').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('hides the add control after every supported platform is configured', async () => {
    const wrapper = await panel({
      ...config(),
      platforms: CONCRETE_PLATFORM_OPTIONS.map(({ value }) => ({ platform: value, enabled: true, models: [] })),
    })
    expect(wrapper.findComponent(Select).exists()).toBe(false)
    expect(button(wrapper, 'addPlatform')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('MonitorSettingsPanel sections and user-facing preview', () => {
  const snapshot = {
    metrics: {
      success_requests: 950, error_requests: 50, request_count: 1000,
      token_count: 0, rpm: 0, tpm: 0, error_rate: 0.05, cache_rate: 0,
      cache_rate_numerator: 0, cache_rate_denominator: 0,
      ttft: { sample_count: 1000, p50_ms: 100, p95_ms: 300, avg_ms: 150 },
      duration: { sample_count: 1000, p50_ms: 500, p95_ms: 900, avg_ms: 600 },
    },
    health: {
      overall: 'healthy', error_rate: 'healthy', ttft: 'healthy',
      minimum_sample: 50, error_weight: 0.6, ttft_weight: 0.2,
      thresholds: { warning_error_rate: 0.05, critical_error_rate: 0.2, minimum_sample: 50, target_ttft_ms: 3000, warning_ttft_ms: 3000, critical_ttft_ms: 10000, error_weight: 0.6, ttft_weight: 0.2 },
    },
  }

  function tab(wrapper: Awaited<ReturnType<typeof panel>>, value: string) {
    return wrapper.findAll('[data-settings-tab]').find(item => item.attributes('data-settings-tab') === value)!
  }

  it('shows one section at a time instead of every card at once', async () => {
    const wrapper = await panel()
    expect(tab(wrapper, 'traffic').attributes('aria-selected')).toBe('true')
    // The platform editor lives in the traffic tab only.
    expect(wrapper.text()).toContain('channelMonitorV2.settings.platformsTitle')
    expect(wrapper.text()).not.toContain('channelMonitorV2.settings.healthTitle')

    await tab(wrapper, 'health').trigger('click')
    expect(tab(wrapper, 'health').attributes('aria-selected')).toBe('true')
    expect(wrapper.text()).not.toContain('channelMonitorV2.settings.platformsTitle')
    expect(wrapper.text()).toContain('channelMonitorV2.settings.healthTitle')

    await tab(wrapper, 'errors').trigger('click')
    expect(wrapper.text()).toContain('channelMonitorV2.settings.errorsTitle')
    expect(wrapper.text()).not.toContain('channelMonitorV2.settings.healthTitle')
    wrapper.unmount()
  })

  it('translates the current 24h traffic into the band users see', async () => {
    mocks.getSnapshot.mockResolvedValue(snapshot)
    const wrapper = await panel()
    expect(mocks.getSnapshot).toHaveBeenCalledWith({ range: '24h', platforms: [], groupIds: [], models: [] })
    const healthTab = tab(wrapper, "health"); await healthTab.trigger("click"); console.log("DEBUG_TEXT", wrapper.text().includes("healthTitle"))
    const previewBlock = wrapper.find('[data-testid="settings-user-preview"]')
    expect(previewBlock.exists()).toBe(true)
    // 5% error rate sits exactly on the watch band (>= warning, < critical).
    const pill = previewBlock.find('.pill')
    expect(pill.exists()).toBe(true)
    expect(pill.classes()).toContain('pill-warn')
    // 95.00% availability is passed into previewBasis as a raw interpolation param.
    expect(wrapper.text()).toContain('previewBasis')
    wrapper.unmount()
  })

  it('explains itself instead of inventing a band when no snapshot is available', async () => {
    const wrapper = await panel()
    const healthTab = tab(wrapper, "health"); await healthTab.trigger("click"); console.log("DEBUG_TEXT", wrapper.text().includes("healthTitle"))
    const previewBlock = wrapper.find('[data-testid="settings-user-preview"]')
    expect(previewBlock.text()).toContain('channelMonitorV2.settings.previewUnavailable')
    expect(previewBlock.find('.pill').exists()).toBe(false)
    wrapper.unmount()
  })
})
