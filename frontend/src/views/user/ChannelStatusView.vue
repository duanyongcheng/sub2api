<template>
  <ChannelStatusV1View v-if="isV1" />
  <AppLayout v-else>
    <ServiceStatusView embedded />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import { isChannelMonitorV1Mode } from '@/utils/featureFlags'
import ChannelStatusV1View from './ChannelStatusV1View.vue'
import ServiceStatusView from './ServiceStatusView.vue'

const isV1 = computed(() => isChannelMonitorV1Mode())
</script>
