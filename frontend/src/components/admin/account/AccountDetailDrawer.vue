<template>
  <BaseDialog :show="show" :title="account?.name || t('admin.accounts.pool.details')" variant="drawer" @close="$emit('close')">
    <div v-if="account" class="space-y-6">
      <section class="border-b border-edge pb-5">
        <div class="mb-3 flex items-center gap-2 text-ink-2">
          <PlatformIcon :platform="account.platform" size="sm" />
          <span class="text-sm">{{ platformLabel(account.platform) }} · {{ account.type }}</span>
          <span class="ml-auto font-mono text-xs text-ink-2">#{{ account.id }}</span>
        </div>
        <AccountStatusIndicator :account="account" accessible-contrast @show-temp-unsched="$emit('tempUnsched', account)" />
        <p v-if="account.error_message" class="mt-3 whitespace-pre-wrap break-words text-sm text-red-600 dark:text-red-400">{{ account.error_message }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="btn btn-secondary btn-sm" @click="$emit('test', account)"><Icon name="play" size="sm" />{{ t('admin.accounts.testConnection') }}</button>
          <button v-if="canRefresh" type="button" class="btn btn-secondary btn-sm" @click="$emit('refresh', account)"><Icon name="refresh" size="sm" />{{ t('admin.accounts.refreshToken') }}</button>
          <button type="button" class="btn btn-secondary btn-sm" @click="$emit('stats', account)"><Icon name="chart" size="sm" />{{ t('admin.accounts.viewStats') }}</button>
        </div>
      </section>
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-ink">{{ t('admin.accounts.columns.capacity') }}</h3>
        <AccountCapacityCell :account="account" />
      </section>
      <section v-if="todayStats || todayStatsLoading || todayStatsError" class="space-y-3 border-t border-edge pt-5">
        <h3 class="text-sm font-semibold text-ink">{{ t('admin.accounts.columns.todayStats') }}</h3>
        <AccountTodayStatsCell accessible-contrast :stats="todayStats ?? null" :loading="todayStatsLoading" :error="todayStatsError" />
      </section>
      <section class="space-y-3 border-t border-edge pt-5">
        <h3 class="text-sm font-semibold text-ink">{{ t('admin.accounts.columns.groups') }}</h3>
        <AccountGroupsCell :groups="account.groups ?? []" :max-display="20" />
        <dl class="account-detail-fields">
          <dt>{{ t('admin.accounts.columns.proxy') }}</dt><dd>{{ account.proxy?.name || '—' }}</dd>
          <dt>{{ t('admin.accounts.columns.priority') }}</dt><dd>{{ account.priority }}</dd>
          <dt>{{ t('admin.accounts.columns.billingRateMultiplier') }}</dt><dd class="tabular-nums">×{{ account.rate_multiplier ?? 1 }}</dd>
        </dl>
      </section>
      <section class="border-t border-edge pt-5">
        <dl class="account-detail-fields">
          <dt>{{ t('admin.accounts.columns.createdAt') }}</dt><dd>{{ formatDateTime(account.created_at) }}</dd>
          <dt>{{ t('admin.accounts.columns.lastUsed') }}</dt><dd>{{ formatDateTime(account.last_used_at) }}</dd>
          <dt>{{ t('admin.accounts.columns.expiresAt') }}</dt><dd>{{ account.expires_at ? formatDateTime(new Date(account.expires_at * 1000)) : '—' }}</dd>
          <dt>{{ t('admin.accounts.notes') }}</dt><dd class="whitespace-pre-wrap">{{ account.notes || '—' }}</dd>
        </dl>
      </section>
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
const canRefresh = computed(() => props.account && !props.account.parent_account_id && ['oauth', 'setup-token'].includes(props.account.type))
</script>

<style scoped>
.account-detail-fields { display: grid; grid-template-columns: minmax(0, 120px) minmax(0, 1fr); gap: 14px 16px; font-size: 13px; }
.account-detail-fields dt { @apply text-ink-2; }
.account-detail-fields dd { @apply break-words text-ink; }
@media (max-width: 400px) { .account-detail-fields { grid-template-columns: minmax(0, 100px) minmax(0, 1fr); gap: 12px; } }
</style>
