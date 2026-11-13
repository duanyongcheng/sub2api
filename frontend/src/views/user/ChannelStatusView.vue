<template>
  <AppLayout>
    <div class="min-w-0 space-y-4 pb-8">
      <p
        v-if="probeListState === 'loading'"
        class="text-sm text-ink-3"
        role="status"
        data-testid="probe-list-loading"
      >
        {{ t('channelMonitorV2.statusTabs.probesLoading') }}
      </p>
      <div
        v-else-if="probeListState === 'error'"
        class="strip strip-bad"
        role="alert"
        data-testid="probe-list-error"
      >
        <span>{{ t('channelMonitorV2.statusTabs.probesLoadError') }}</span>
        <button
          type="button"
          class="btn btn-secondary btn-sm ml-auto"
          data-testid="probe-list-retry"
          @click="refreshProbeCount"
        >
          {{ t('common.tryAgain') }}
        </button>
      </div>
      <!-- The tab bar only appears when both evidence sources exist. With a
           single source the page is that source, exactly as it was before. -->
      <div
        v-if="showTabs"
        class="tabs inline-flex max-w-full flex-wrap"
        role="tablist"
        :aria-label="t('channelMonitorV2.statusTabs.aria')"
        data-testid="status-tabs"
      >
        <button
          v-for="tab in availableTabs"
          :key="tab.value"
          type="button"
          role="tab"
          class="tab"
          :class="activeTab === tab.value ? 'tab-active' : ''"
          :aria-selected="activeTab === tab.value"
          :data-status-tab="tab.value"
          @click="activeTab = tab.value"
        >
          {{ t(tab.labelKey) }}
        </button>
      </div>

      <ServiceStatusView v-if="activeTab === 'traffic' && trafficAvailable" embedded @refresh="refreshProbeCount" />
      <ChannelStatusV1View v-else-if="probesEnabled" embedded @loaded="updateProbeCount" />
      <p v-else class="text-sm text-ink-3" role="status">{{ t('channelMonitorV2.statusTabs.noSources') }}</p>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import { isChannelMonitorProbesEnabled, isChannelMonitorV2Mode } from '@/utils/featureFlags'
import * as monitorApi from '@/api/channelMonitor'
import ChannelStatusV1View from './ChannelStatusV1View.vue'
import ServiceStatusView from './ServiceStatusView.vue'

type StatusTab = 'traffic' | 'probes'

const { t } = useI18n()
const activeTab = ref<StatusTab>(isChannelMonitorV2Mode() ? 'traffic' : 'probes')
const probeCount = ref<number | null>(null)
const probeListState = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
let probeController: AbortController | null = null
let probeRequest: Promise<void> | null = null
let disposed = false

// The passive view needs the V2 aggregator, which only runs in v2 mode.
const trafficAvailable = computed(() => isChannelMonitorV2Mode())
const probesEnabled = computed(() => isChannelMonitorProbesEnabled())
// Probes are an independent switch. The tab appears once the site actually has
// at least one probe: an empty tab would only puzzle users, and the count is
// unknown until fetched, so stay hidden meanwhile.
const probesAvailable = computed(
  () => probesEnabled.value && (probeCount.value ?? 0) > 0
)

const availableTabs = computed(() =>
  [
    { value: 'traffic' as const, labelKey: 'channelMonitorV2.statusTabs.traffic' },
    { value: 'probes' as const, labelKey: 'channelMonitorV2.statusTabs.probes' },
  ].filter((tab) => (tab.value === 'traffic' ? trafficAvailable.value : probesAvailable.value))
)
const showTabs = computed(() => availableTabs.value.length > 1)

// Keep the selection valid when a tab disappears (e.g. probes were removed).
watch(availableTabs, (tabs) => {
  if (tabs.length && !tabs.some((tab) => tab.value === activeTab.value)) {
    activeTab.value = tabs[0].value
  }
})

function cancelProbeRequest() {
  probeController?.abort()
  probeController = null
  probeRequest = null
}

function refreshProbeCount(): Promise<void> {
  if (disposed || !probesEnabled.value || !trafficAvailable.value) return Promise.resolve()
  if (probeRequest) return probeRequest
  const controller = new AbortController()
  probeController = controller
  const current = () => !disposed && probeController === controller && !controller.signal.aborted
  probeListState.value = 'loading'
  const request = monitorApi
    .list({ signal: controller.signal })
    .then((result) => {
      if (!current()) return
      probeCount.value = result.items?.length ?? 0
      probeListState.value = 'success'
    })
    .catch(() => {
      if (current()) probeListState.value = 'error'
    })
    .finally(() => {
      if (!current()) return
      probeController = null
      probeRequest = null
    })
  probeRequest = request
  return request
}

// The probe view already fetches this list; reuse its successful result.
function updateProbeCount(count: number) {
  if (disposed || !probesEnabled.value) return
  cancelProbeRequest()
  probeCount.value = count
  probeListState.value = 'success'
}

watch([probesEnabled, trafficAvailable], ([enabled, traffic]) => {
  cancelProbeRequest()
  probeListState.value = 'idle'
  if (!enabled) probeCount.value = null
  else if (traffic) void refreshProbeCount()
}, { immediate: true, flush: 'sync' })

onBeforeUnmount(() => {
  disposed = true
  cancelProbeRequest()
})
</script>
