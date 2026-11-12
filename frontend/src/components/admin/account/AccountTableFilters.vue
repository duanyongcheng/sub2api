<template>
  <div class="account-filters min-w-0 flex-1">
    <div class="account-primary-filters flex flex-wrap items-center gap-2">
      <label class="account-search min-w-36 flex-1">
        <span class="sr-only">{{ t('admin.accounts.searchAccounts') }}</span>
        <SearchInput
          :model-value="searchQuery"
          :placeholder="t('admin.accounts.searchAccounts')"
          class="w-full"
          @update:model-value="$emit('update:searchQuery', $event)"
          @search="$emit('change')"
        />
      </label>
      <Select
        :model-value="filters.status"
        :aria-label="t('admin.accounts.columns.status')"
        class="account-status-filter w-32 shrink-0"
        :options="sOpts"
        @update:model-value="updateStatus"
        @change="$emit('change')"
      />
      <Select
        v-if="!hidePlatform"
        :model-value="filters.platform"
        :aria-label="t('admin.accounts.columns.platform')"
        class="account-secondary-filter w-40 shrink-0"
        :options="pOpts"
        @update:model-value="updatePlatform"
        @change="$emit('change')"
      />
      <Select
        v-if="!hideGroup"
        :model-value="filters.group"
        :aria-label="t('admin.accounts.columns.groups')"
        class="account-secondary-filter w-44 shrink-0"
        :options="gOpts"
        @update:model-value="updateGroup"
        @change="$emit('change')"
      />
      <Select
        :model-value="filters.type"
        :aria-label="t('admin.accounts.columns.type')"
        class="account-secondary-filter w-40 shrink-0"
        :options="tOpts"
        @update:model-value="updateType"
        @change="$emit('change')"
      />
      <Select
        :model-value="filters.privacy_mode"
        :aria-label="t('admin.accounts.workspace.privacyStatus')"
        class="account-secondary-filter w-44 shrink-0"
        :options="privacyOpts"
        @update:model-value="updatePrivacyMode"
        @change="$emit('change')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Select from '@/components/common/Select.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import type { AdminGroup } from '@/types'
import { CONCRETE_PLATFORM_OPTIONS } from '@/constants/platforms'

const props = defineProps<{ searchQuery: string; filters: Record<string, string | number | boolean | null | undefined>; groups?: AdminGroup[]; hidePlatform?: boolean; hideGroup?: boolean }>()
const emit = defineEmits(['update:searchQuery', 'update:filters', 'change'])
const { t } = useI18n()
const updateFilter = (key: string, value: string | number | boolean | null) => emit('update:filters', { ...props.filters, [key]: value })
const updatePlatform = (value: string | number | boolean | null) => updateFilter('platform', value)
const updateType = (value: string | number | boolean | null) => updateFilter('type', value)
const updateStatus = (value: string | number | boolean | null) => updateFilter('status', value)
const updatePrivacyMode = (value: string | number | boolean | null) => updateFilter('privacy_mode', value)
const updateGroup = (value: string | number | boolean | null) => updateFilter('group', value)
const pOpts = computed(() => [{ value: '', label: t('admin.accounts.allPlatforms') }, ...CONCRETE_PLATFORM_OPTIONS])
const tOpts = computed(() => [{ value: '', label: t('admin.accounts.allTypes') }, { value: 'oauth', label: t('admin.accounts.oauthType') }, { value: 'setup-token', label: t('admin.accounts.setupToken') }, { value: 'apikey', label: t('admin.accounts.apiKey') }, { value: 'bedrock', label: 'AWS Bedrock' }])
const sOpts = computed(() => [{ value: '', label: t('admin.accounts.allStatus') }, { value: 'active', label: t('admin.accounts.status.active') }, { value: 'inactive', label: t('admin.accounts.status.inactive') }, { value: 'error', label: t('admin.accounts.status.error') }, { value: 'rate_limited', label: t('admin.accounts.status.rateLimited') }, { value: 'temp_unschedulable', label: t('admin.accounts.status.tempUnschedulable') }, { value: 'unschedulable', label: t('admin.accounts.status.unschedulable') }])
const privacyOpts = computed(() => [
  { value: '', label: t('admin.accounts.allPrivacyModes') },
  { value: '__unset__', label: t('admin.accounts.privacyUnset') },
  { value: 'training_off', label: 'Privacy' },
  { value: 'training_set_cf_blocked', label: 'CF' },
  { value: 'training_set_failed', label: 'Fail' }
])
const gOpts = computed(() => [
  { value: '', label: t('admin.accounts.allGroups') },
  { value: 'ungrouped', label: t('admin.accounts.ungroupedGroup') },
  ...(props.groups || []).map(g => ({ value: String(g.id), label: g.name }))
])
</script>

<style scoped>
@media (max-width: 1023px) {
  .account-search { flex-basis: 100%; }
  .account-status-filter,
  .account-secondary-filter { min-width: 0; flex: 1 1 140px; width: auto; }
}
</style>
