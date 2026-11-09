<template>
  <BaseDialog :show="show" :title="account?.name || t('admin.accounts.pool.details')" variant="drawer" @close="$emit('close')">
    <div v-if="account" class="space-y-5">
      <section class="rounded-field border border-edge bg-surface-2 p-4">
        <div class="mb-3 flex items-center gap-2"><PlatformIcon :platform="account.platform" size="sm" /><span class="text-sm font-semibold text-ink">{{ platformLabel(account.platform) }} · {{ account.type }}</span></div>
        <AccountStatusIndicator :account="account" @show-temp-unsched="$emit('tempUnsched', account)" />
        <p v-if="account.error_message" class="mt-3 whitespace-pre-wrap break-words text-xs text-red-600">{{ account.error_message }}</p>
      </section>
      <dl class="grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-3 text-xs">
        <dt class="text-ink-3">ID</dt><dd class="font-mono text-ink">#{{ account.id }}</dd>
        <dt class="text-ink-3">{{ t('admin.accounts.columns.priority') }}</dt><dd class="text-ink">{{ account.priority }}</dd>
        <dt class="text-ink-3">{{ t('admin.accounts.columns.billingRateMultiplier') }}</dt><dd class="text-ink">×{{ account.rate_multiplier ?? 1 }}</dd>
        <dt class="text-ink-3">{{ t('admin.accounts.columns.capacity') }}</dt><dd><AccountCapacityCell :account="account" /></dd>
        <dt class="text-ink-3">{{ t('admin.accounts.columns.proxy') }}</dt><dd class="break-words text-ink">{{ account.proxy?.name || '—' }}</dd>
        <dt class="text-ink-3">{{ t('admin.accounts.columns.groups') }}</dt><dd><AccountGroupsCell :groups="account.groups ?? []" :max-display="20" /></dd>
        <dt class="text-ink-3">{{ t('admin.accounts.columns.lastUsed') }}</dt><dd class="text-ink">{{ formatDateTime(account.last_used_at) }}</dd>
        <dt class="text-ink-3">{{ t('admin.accounts.columns.expiresAt') }}</dt><dd class="text-ink">{{ account.expires_at ? formatDateTime(new Date(account.expires_at * 1000)) : '—' }}</dd>
        <dt class="text-ink-3">{{ t('admin.accounts.notes') }}</dt><dd class="whitespace-pre-wrap break-words text-ink">{{ account.notes || '—' }}</dd>
      </dl>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-secondary btn-sm" @click="$emit('test', account)"><Icon name="play" size="sm" />{{ t('admin.accounts.testConnection') }}</button>
        <button v-if="canRefresh" type="button" class="btn btn-secondary btn-sm" @click="$emit('refresh', account)"><Icon name="refresh" size="sm" />{{ t('admin.accounts.refreshToken') }}</button>
        <button type="button" class="btn btn-secondary btn-sm" @click="$emit('stats', account)"><Icon name="chart" size="sm" />{{ t('admin.accounts.viewStats') }}</button>
      </div>
    </div>
    <template #footer><button type="button" class="btn btn-secondary" @click="$emit('close')">{{ t('common.close') }}</button><button v-if="account" type="button" class="btn btn-primary" @click="$emit('edit', account)">{{ t('common.edit') }}</button></template>
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
import AccountGroupsCell from '@/components/account/AccountGroupsCell.vue'
import { platformLabel } from '@/utils/platformColors'
import { formatDateTime } from '@/utils/format'
import type { Account } from '@/types'
const props = defineProps<{ show: boolean; account: Account | null }>()
defineEmits<{ close: []; edit: [account: Account]; test: [account: Account]; refresh: [account: Account]; stats: [account: Account]; tempUnsched: [account: Account] }>()
const { t } = useI18n()
const canRefresh = computed(() => props.account && !props.account.parent_account_id && ['oauth', 'setup-token'].includes(props.account.type))
</script>
