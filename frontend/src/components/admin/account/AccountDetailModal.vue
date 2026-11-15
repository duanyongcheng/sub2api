<template>
  <BaseDialog
    :show="show"
    :title="t('admin.accounts.pool.details')"
    width="wide"
    :close-on-click-outside="true"
    @close="$emit('close')"
  >
    <div v-if="account" class="account-detail-content">
      <section class="pb-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <h2 class="break-words text-base font-semibold text-ink [overflow-wrap:anywhere]">{{ account.name }}</h2>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <PlatformIcon :platform="account.platform" size="sm" />
              <span>{{ platformLabel(account.platform) }} · {{ account.type }}</span>
              <span class="font-mono text-xs">#{{ account.id }}</span>
            </div>
          </div>
          <AccountStatusIndicator :account="account" accessible-contrast @show-temp-unsched="$emit('tempUnsched', account)" />
        </div>
        <p v-if="account.error_message" class="mt-3 whitespace-pre-wrap break-words text-sm text-red-700 dark:text-red-300">{{ account.error_message }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="btn btn-secondary btn-sm" @click="$emit('test', account)"><Icon name="play" size="sm" />{{ t('admin.accounts.testConnection') }}</button>
          <button v-if="canRefresh" type="button" class="btn btn-secondary btn-sm" @click="$emit('refresh', account)"><Icon name="refresh" size="sm" />{{ t('admin.accounts.refreshToken') }}</button>
          <button type="button" class="btn btn-secondary btn-sm" @click="$emit('stats', account)"><Icon name="chart" size="sm" />{{ t('admin.accounts.viewStats') }}</button>
        </div>
      </section>
      <div class="grid gap-x-8 md:grid-cols-2">
        <section class="min-w-0 space-y-3 border-t border-edge py-5">
          <h3 class="text-sm font-semibold text-ink">{{ t('admin.accounts.columns.capacity') }}</h3>
          <AccountCapacityCell :account="account" />
        </section>
        <section v-if="hasTodayStats" class="min-w-0 space-y-3 border-t border-edge py-5">
          <h3 class="text-sm font-semibold text-ink">{{ t('admin.accounts.columns.todayStats') }}</h3>
          <AccountTodayStatsCell accessible-contrast :stats="todayStats ?? null" :loading="todayStatsLoading" :error="todayStatsError" />
        </section>
        <section class="min-w-0 space-y-3 border-t border-edge py-5">
          <h3 class="text-sm font-semibold text-ink">{{ t('admin.accounts.columns.groups') }}</h3>
          <AccountGroupsCell :groups="account.groups ?? []" :max-display="20" />
          <dl class="account-detail-fields">
            <dt>{{ t('admin.accounts.columns.proxy') }}</dt><dd>{{ account.proxy?.name || '—' }}</dd>
            <dt>{{ t('admin.accounts.columns.priority') }}</dt><dd>{{ account.priority }}</dd>
            <dt>{{ t('admin.accounts.columns.billingRateMultiplier') }}</dt><dd class="tabular-nums">×{{ account.rate_multiplier ?? 1 }}</dd>
          </dl>
        </section>
        <section class="min-w-0 border-t border-edge py-5" :class="{ 'md:col-span-2': !hasTodayStats }">
          <dl class="account-detail-fields">
            <dt>{{ t('admin.accounts.columns.createdAt') }}</dt><dd>{{ formatDateTime(account.created_at) }}</dd>
            <dt>{{ t('admin.accounts.columns.lastUsed') }}</dt><dd>{{ formatDateTime(account.last_used_at) }}</dd>
            <dt>{{ t('admin.accounts.columns.expiresAt') }}</dt><dd>{{ account.expires_at ? formatDateTime(new Date(account.expires_at * 1000)) : '—' }}</dd>
            <dt>{{ t('admin.accounts.notes') }}</dt><dd class="whitespace-pre-wrap">{{ account.notes || '—' }}</dd>
          </dl>
        </section>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="$emit('close')">{{ t('common.close') }}</button>
      <button v-if="account" type="button" class="btn btn-primary" @click="$emit('edit', account)">{{ t('common.edit') }}</button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import Icon from '@/components/icons/Icon.vue'
import AccountStatusIndicator from '@/components/account/AccountStatusIndicator.vue'
import AccountCapacityCell from '@/components/account/AccountCapacityCell.vue'
import AccountTodayStatsCell from '@/components/account/AccountTodayStatsCell.vue'
import AccountGroupsCell from '@/components/account/AccountGroupsCell.vue'
import { platformLabel } from '@/utils/platformColors'
import { formatDateTime } from '@/utils/format'
import type { Account, WindowStats } from '@/types'

const props = defineProps<{ show: boolean; account: Account | null; todayStats?: WindowStats | null; todayStatsLoading?: boolean; todayStatsError?: string | null }>()
defineEmits<{ close: []; edit: [account: Account]; test: [account: Account]; refresh: [account: Account]; stats: [account: Account]; tempUnsched: [account: Account] }>()
const { t } = useI18n()
const hasTodayStats = computed(() => Boolean(props.todayStats || props.todayStatsLoading || props.todayStatsError))
const canRefresh = computed(() => props.account && !props.account.parent_account_id && ['oauth', 'setup-token'].includes(props.account.type))
</script>

<style scoped>
.account-detail-fields {
  display: grid;
  grid-template-columns: minmax(0, 100px) minmax(0, 1fr);
  gap: 12px 16px;
  font-size: 13px;
}
.account-detail-fields dt { @apply text-ink-2; }
.account-detail-fields dd { @apply min-w-0 break-words text-ink; overflow-wrap: anywhere; }
</style>
