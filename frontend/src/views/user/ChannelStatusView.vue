<template>
  <AppLayout>
    <div class="min-w-0 space-y-4 pb-8">
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

      <ServiceStatusView v-if="activeTab === 'traffic'" embedded />
      <ChannelStatusV1View v-else embedded />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import { isChannelMonitorProbesEnabled, isChannelMonitorV2Mode } from '@/utils/featureFlags'
import * as monitorApi from '@/api/channelMonitor'
import ChannelStatusV1View from './ChannelStatusV1View.vue'
import ServiceStatusView from './ServiceStatusView.vue'

type StatusTab = 'traffic' | 'probes'

const { t } = useI18n()
const activeTab = ref<StatusTab>(isChannelMonitorV2Mode() ? 'traffic' : 'probes')
/** null = not fetched yet; only fetched when the probe switch is on. */
const probeCount = ref<number | null>(null)

// The passive view needs the V2 aggregator, which only runs in v2 mode.
const trafficAvailable = computed(() => isChannelMonitorV2Mode())
// Probes are an independent switch. The tab appears once the site actually has
// at least one probe: an empty tab would only puzzle users, and the count is
// unknown until fetched, so stay hidden meanwhile.
const probesAvailable = computed(
  () => isChannelMonitorProbesEnabled() && (probeCount.value ?? 0) > 0
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

onMounted(() => {
  if (!isChannelMonitorProbesEnabled()) return
  void monitorApi
    .list()
    .then((result) => {
      probeCount.value = result.items?.length ?? 0
    })
    .catch(() => {
      // A failed probe count must not break the passive view; treat as none.
      probeCount.value = 0
    })
})
</script>
