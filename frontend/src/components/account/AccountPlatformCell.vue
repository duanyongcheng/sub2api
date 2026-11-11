<template>
  <span
    :class="['inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', platformBadgeLightClass(platform)]"
    :title="label"
  >
    <PlatformIcon :platform="platform" size="xs" />
    <span class="truncate">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AccountPlatform } from '@/types'
import { platformBadgeLightClass, platformLabel as sharedPlatformLabel } from '@/utils/platformColors'
import PlatformIcon from '@/components/common/PlatformIcon.vue'

// 平台独立成列，只显示平台本身；类型/套餐等账号自身信息在名称单元格里。
const props = defineProps<{ platform: AccountPlatform }>()

const label = computed(() => sharedPlatformLabel(props.platform))
</script>
