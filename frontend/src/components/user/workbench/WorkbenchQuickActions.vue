<template>
  <section class="card">
    <div class="card-hd">
      <h3 class="text-sm font-semibold text-ink">{{ t('dashboard.quickActions') }}</h3>
    </div>
    <div class="card-bd flex flex-col gap-2">
      <router-link v-for="action in actions" :key="action.to" :to="action.to" class="qa-item group">
        <span class="qa-icon" :style="{ background: action.bg, color: action.color }">
          <Icon :name="action.icon" size="md" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[12.8px] font-semibold text-ink">{{ action.title }}</span>
          <span class="mt-0.5 block truncate text-[11.3px] text-ink-3">{{ action.description }}</span>
        </span>
        <Icon name="chevronRight" size="sm" class="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'

/**
 * WorkbenchQuickActions — the rows that used to live in a 4-card grid.
 *
 * Rendered as a vertical list with a coloured icon tile so it can share the
 * right rail with the platform breakdown without pushing it below the fold.
 */
const { t } = useI18n()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()

interface ActionRow {
  to: string
  icon: InstanceType<typeof Icon>['$props']['name']
  title: string
  description: string
  bg: string
  color: string
}

const actions = computed(() => {
  const list: ActionRow[] = [
    {
      to: '/keys',
      icon: 'key',
      title: t('dashboard.createApiKey'),
      description: t('dashboard.workbench.quickActionCreateKeyDesc'),
      bg: 'rgb(var(--primary-50))',
      color: 'rgb(var(--primary-700))'
    },
    {
      to: '/usage',
      icon: 'chart',
      title: t('dashboard.viewUsage'),
      description: t('dashboard.workbench.quickActionUsageDesc'),
      bg: 'rgb(59 130 246 / 0.12)',
      color: 'rgb(37 99 235)'
    },
    {
      to: '/redeem',
      icon: 'gift',
      title: t('dashboard.redeemCode'),
      description: t('dashboard.workbench.quickActionRedeemDesc'),
      bg: 'rgb(245 158 11 / 0.14)',
      color: 'rgb(217 119 6)'
    }
  ]

  if (canUseBatchImage.value) {
    list.push({
      to: '/batch-image',
      icon: 'sparkles',
      title: t('dashboard.batchImageAgent'),
      description: t('dashboard.workbench.quickActionBatchImageDesc'),
      bg: 'rgb(139 92 246 / 0.14)',
      color: 'rgb(124 58 237)'
    })
  }

  return list
})

onMounted(() => {
  void refreshBatchImageAccess()
})
</script>

<style scoped>
.qa-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgb(var(--edge));
  background: rgb(var(--surface));
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.qa-item:hover {
  border-color: rgba(45, 212, 191, 0.6);
  background: rgb(var(--primary-50) / 0.55);
}

.qa-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border-radius: 9px;
}
</style>
