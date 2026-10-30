<template>
  <span class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" :class="availabilityTone[state].pill">
    <i class="h-1.5 w-1.5 rounded-full" :class="availabilityTone[state].dot" />
    {{ t(`channelMonitorV2.availability.states.${state}`) }}
  </span>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { HealthState } from '@/api/channelMonitorV2'
import { availabilityTone } from './monitorAvailability'

defineProps<{ state: HealthState }>()
const { t } = useI18n()
</script>
