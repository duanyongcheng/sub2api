<template>
  <ChannelStatusV1View v-if="isV1" />
  <!-- 服务状态页：按分组给结论，只用真实流量证据（设计原型 10 号稿，已去掉探测合并） -->
  <ServiceStatusView v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { isChannelMonitorV1Mode } from '@/utils/featureFlags'
import ChannelStatusV1View from './ChannelStatusV1View.vue'
import ServiceStatusView from './ServiceStatusView.vue'

const isV1 = computed(() => isChannelMonitorV1Mode())
</script>
