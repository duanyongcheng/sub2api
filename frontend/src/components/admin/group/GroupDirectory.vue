<template>
  <aside
    class="group-directory card min-w-0 lg:flex lg:h-full lg:flex-col"
    :aria-label="t('admin.groups.workspace.groupList')"
  >
    <header class="flex shrink-0 items-center justify-between gap-2 border-b border-edge px-3 py-2">
      <div class="flex min-w-0 items-baseline gap-1.5">
        <h2 class="truncate text-sm font-semibold text-ink">{{ t('admin.groups.workspace.groupList') }}</h2>
        <span class="text-[11px] font-medium tabular-nums text-ink-2">{{ total }}</span>
      </div>
      <div class="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          class="directory-icon"
          :disabled="loading"
          :title="t('common.refresh')"
          :aria-label="t('common.refresh')"
          @click="$emit('refresh')"
        >
          <Icon name="refresh" size="sm" :class="{ 'animate-spin': loading }" />
        </button>
        <button
          type="button"
          class="directory-icon"
          :title="t('admin.groups.workspace.tableView')"
          :aria-label="t('admin.groups.workspace.tableView')"
          @click="$emit('view')"
        >
          <Icon name="grid" size="sm" />
        </button>
        <button
          v-if="!simple"
          type="button"
          class="directory-icon"
          :title="t('admin.groups.sortOrderHint')"
          :aria-label="t('admin.groups.sortOrder')"
          @click="$emit('sort')"
        >
          <Icon name="arrowsUpDown" size="sm" />
        </button>
        <button
          type="button"
          class="btn btn-primary btn-icon btn-sm ml-1"
          data-tour="groups-create-btn"
          :title="t('admin.groups.createGroup')"
          :aria-label="t('admin.groups.createGroup')"
          @click="$emit('create')"
        >
          <Icon name="plus" size="sm" />
        </button>
      </div>
    </header>

    <button
      ref="mobileTrigger"
      type="button"
      class="flex w-full items-center gap-3 px-4 py-3 text-left lg:hidden"
      :aria-expanded="mobileOpen"
      :aria-controls="navigationId"
      @click="mobileOpen = !mobileOpen"
    >
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-field border border-edge bg-surface-2 text-ink-2">
        <PlatformIcon v-if="selectedGroup" :platform="selectedGroup.platform" size="md" />
        <Icon v-else name="filter" size="sm" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold text-ink">{{ selectedGroup?.name ?? t('admin.groups.workspace.selectGroupShort') }}</span>
        <span class="mt-0.5 block truncate text-[11px] text-ink-2">{{ selectedMeta }}</span>
      </span>
      <Icon :name="mobileOpen ? 'chevronUp' : 'chevronDown'" size="sm" class="shrink-0 text-ink-3" />
    </button>

    <div :id="navigationId" class="min-h-0 lg:flex lg:flex-1 lg:flex-col" :class="mobileOpen ? 'block' : 'hidden lg:flex'">
      <div class="shrink-0 px-3 pb-3 pt-3">
        <div class="relative">
          <Icon name="search" size="sm" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            :value="search"
            type="search"
            class="input w-full pl-8 text-xs"
            :placeholder="t('admin.groups.searchGroups')"
            :aria-label="t('admin.groups.searchGroups')"
            @input="$emit('search', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Select
            :model-value="platform"
            :options="platformOptions"
            :aria-label="t('admin.groups.allPlatforms')"
            @update:model-value="$emit('platform', String($event))"
          />
          <div class="status-filter" role="group" :aria-label="t('admin.groups.allStatus')">
            <button
              v-for="option in shortStatusOptions"
              :key="option.value"
              type="button"
              class="status-filter-button"
              :class="status === option.value ? 'status-filter-button-active' : ''"
              :aria-pressed="status === option.value"
              @click="$emit('status', option.value)"
            >{{ option.label }}</button>
          </div>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2" :aria-busy="loading">
        <button
          v-for="group in groups"
          :key="group.id"
          type="button"
          class="group-row"
          :class="selectedId === group.id ? 'group-row-selected' : ''"
          :aria-current="selectedId === group.id ? 'true' : undefined"
          :data-group-id="group.id"
          @click="$emit('select', group); closeDirectory()"
        >
          <span class="group-row-icon">
            <PlatformIcon :platform="group.platform" size="sm" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-semibold leading-5">{{ group.name }}</span>
            <span class="group-row-meta mt-0.5 block truncate text-[11px] leading-4 text-ink-2">
              {{ platformLabel(group.platform) }} · ×{{ group.rate_multiplier }} · {{ group.account_count ?? 0 }} {{ t('admin.groups.accountsUnit') }}
            </span>
          </span>
          <span class="group-row-status">
            <span class="h-1.5 w-1.5 rounded-full" :class="group.status === 'active' ? 'bg-emerald-500' : 'bg-ink-3'" />
            {{ t(`admin.accounts.status.${group.status}`) }}
          </span>
        </button>
        <div v-if="loading && !groups.length" class="space-y-1.5 px-1 py-2">
          <div v-for="index in 5" :key="index" class="h-[52px] animate-pulse rounded-field bg-surface-2" />
        </div>
        <div v-else-if="!loading && !groups.length" class="px-2 py-8 text-center">
          <p class="text-xs leading-5 text-ink-2">{{ t('admin.groups.workspace.noMatchingGroups') }}</p>
          <button
            v-if="search || platform || status"
            type="button"
            class="mt-2 text-xs font-medium text-primary-700 hover:text-primary-600"
            @click="$emit('clear')"
          >{{ t('admin.groups.workspace.clearFilters') }}</button>
        </div>
      </div>

    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import Select from '@/components/common/Select.vue'
import { platformLabel } from '@/utils/platformColors'
import type { AdminGroup } from '@/types'

const props = defineProps<{
  groups: AdminGroup[]
  selectedId: number | null
  loading: boolean
  search: string
  platform: string
  status: string
  platformOptions: { value: string; label: string }[]
  statusOptions: { value: string; label: string }[]
  total: number
  simple: boolean
}>()
defineEmits<{
  select: [group: AdminGroup]
  search: [value: string]
  platform: [value: string]
  status: [value: string]
  sort: []
  clear: []
  refresh: []
  view: []
  create: []
}>()
const { t } = useI18n()
const mobileOpen = ref(false)
const mobileTrigger = ref<HTMLButtonElement | null>(null)
const navigationId = `group-directory-${getCurrentInstance()?.uid}`

const selectedGroup = computed(() => props.groups.find(group => group.id === props.selectedId) ?? null)
const selectedMeta = computed(() => {
  const group = selectedGroup.value
  if (!group) return t('admin.groups.workspace.totalGroups', { count: props.total })
  return `${platformLabel(group.platform)} · ×${group.rate_multiplier} · ${group.account_count ?? 0} ${t('admin.groups.accountsUnit')}`
})
const shortStatusOptions = computed(() => props.statusOptions.map(option => ({
  ...option,
  label: option.value === '' ? t('common.all') : option.label
})))

const closeDirectory = () => {
  if (!mobileOpen.value) return
  mobileOpen.value = false
  void nextTick(() => mobileTrigger.value?.focus())
}
watch(() => props.selectedId, (value, previous) => {
  if (value !== previous && value !== null) closeDirectory()
})
</script>

<style scoped>
.group-directory {
  @apply overflow-hidden;
}
.directory-icon {
  @apply grid h-7 w-7 place-items-center rounded-md text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none;
}
.group-row {
  @apply flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 motion-reduce:transition-none;
}
.group-row-selected {
  @apply bg-primary-50 text-primary-700;
}
.group-row-selected:hover {
  @apply bg-primary-50;
}
.group-row-icon {
  @apply grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-edge bg-surface text-ink-2;
}
.group-row-selected .group-row-icon {
  @apply border-primary-500/25 bg-surface text-primary-700;
}
.group-row-status {
  @apply flex shrink-0 items-center gap-1 text-[10.5px] font-medium text-ink-2;
}
.group-row-selected .group-row-status,
.group-row-selected .group-row-meta {
  @apply text-primary-700/80;
}
.status-filter {
  @apply inline-flex items-center rounded-field border border-edge bg-surface-2 p-0.5;
}
.status-filter-button {
  @apply rounded-md px-2 py-1.5 text-[11px] font-medium text-ink-2 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 motion-reduce:transition-none;
}
.status-filter-button-active {
  @apply bg-surface text-ink shadow-xs;
}
</style>
