<template>
  <section class="card min-w-0 overflow-hidden" :aria-label="group.name">
    <div class="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-field border border-edge bg-surface-2 text-ink-2">
        <PlatformIcon :platform="group.platform" size="lg" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 class="min-w-0 truncate text-[19px] font-semibold leading-7 tracking-[-0.02em] text-ink">{{ group.name }}</h2>
          <StatusPill :tone="group.status === 'active' ? 'ok' : 'neutral'">{{ t(`admin.accounts.status.${group.status}`) }}</StatusPill>
          <StatusPill v-if="group.subscription_type === 'subscription'" tone="violet" :dot="false">{{ t('admin.groups.subscription.subscription') }}</StatusPill>
          <StatusPill v-if="group.is_exclusive" tone="brand" :dot="false">{{ t('admin.groups.exclusive') }}</StatusPill>
          <span class="chip tabular-nums">×{{ group.rate_multiplier }}</span>
        </div>
        <p v-if="group.description" class="mt-1 max-w-[72ch] whitespace-normal text-[12.5px] leading-5 text-ink-2">{{ group.description }}</p>
        <p v-else class="mt-1 text-[12px] leading-5 text-ink-2">{{ t('admin.groups.workspace.noDescription') }}</p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-1.5">
        <button
          v-if="!simple"
          type="button"
          class="btn btn-secondary btn-sm"
          data-testid="group-duplicate"
          :disabled="duplicating"
          @click="$emit('duplicate')"
        >
          <Icon name="copy" size="sm" />
          {{ duplicating ? t('admin.groups.duplicating') : t('admin.groups.duplicate') }}
        </button>
        <button
          v-if="!simple"
          type="button"
          class="btn btn-secondary btn-sm"
          data-testid="group-rate-multipliers"
          @click="$emit('rates')"
        >
          <Icon name="dollar" size="sm" />
          {{ t('admin.groups.rateMultipliers') }}
        </button>
        <button
          v-if="!simple"
          type="button"
          class="btn btn-secondary btn-sm"
          data-testid="group-rpm-overrides"
          @click="$emit('rpm')"
        >
          <Icon name="bolt" size="sm" />
          {{ t('admin.groups.rpmOverrides') }}
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-icon btn-sm text-ink-3 hover:text-red-600"
          data-testid="group-delete"
          :aria-label="t('admin.groups.deleteGroup')"
          :title="t('admin.groups.deleteGroup')"
          @click="$emit('delete')"
        >
          <Icon name="trash" size="sm" />
        </button>
      </div>
    </div>
    <GroupEconomicsSummary v-if="!simple" :group="group" :draft-rate="draftRate" />
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import GroupEconomicsSummary from './GroupEconomicsSummary.vue'
import type { AdminGroup } from '@/types'

defineProps<{ group: AdminGroup; draftRate: number; simple: boolean; duplicating: boolean }>()
defineEmits<{ duplicate: []; rates: []; rpm: []; delete: [] }>()
const { t } = useI18n()
</script>
