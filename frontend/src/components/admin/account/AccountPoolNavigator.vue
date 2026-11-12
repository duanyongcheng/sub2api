<template>
  <div class="pool-directory bg-surface-2" @keydown.esc="closeDirectory">
    <button
      ref="mobileTrigger"
      type="button"
      class="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 lg:hidden"
      :aria-label="t('admin.accounts.workspace.selectPool')"
      :aria-expanded="mobileOpen"
      :aria-controls="navigationId"
      @click="mobileOpen = !mobileOpen"
    >
      <Icon name="filter" size="sm" class="text-ink-2" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate">{{ selectedLabel }}</span>
      <Icon :name="mobileOpen ? 'chevronUp' : 'chevronDown'" size="sm" aria-hidden="true" />
    </button>

    <nav
      :id="navigationId"
      :aria-label="t('admin.accounts.workspace.pools')"
      :aria-busy="loading"
      class="px-3 pb-3 pt-1 lg:block lg:py-4"
      :class="mobileOpen ? 'block' : 'hidden'"
    >
      <div class="mb-3 hidden min-h-6 items-center gap-2 px-1 lg:flex">
        <h2 class="min-w-0 flex-1 text-sm font-semibold text-ink">{{ t('admin.accounts.workspace.pools') }}</h2>
        <button
          v-if="collapsibleSections.length && !searching"
          type="button"
          class="directory-action"
          data-pool-toggle="all"
          @click="toggleAll"
        >
          {{ t(allCollapsed ? 'admin.accounts.workspace.expandAll' : 'admin.accounts.workspace.collapseAll') }}
        </button>
      </div>
      <RouterLink to="/admin/groups" class="pool-link mb-3 text-xs text-ink-2 hover:text-primary-700">
        <Icon name="cog" size="sm" aria-hidden="true" />
        {{ t('admin.accounts.workspace.manageGroups') }}
        <Icon name="arrowRight" size="xs" class="ml-auto" aria-hidden="true" />
      </RouterLink>
      <div class="relative mb-3">
        <Icon name="search" size="sm" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2" aria-hidden="true" />
        <input
          v-model="search"
          type="search"
          class="input w-full pl-8 text-xs placeholder:text-ink-2"
          :placeholder="t('admin.accounts.workspace.searchPools')"
          :aria-label="t('admin.accounts.workspace.filterPools')"
        />
      </div>

      <div class="space-y-0.5">
        <button
          type="button"
          class="pool-link font-medium"
          :class="isSelected('', '') ? 'bg-primary-50 font-semibold text-primary-700' : 'text-ink hover:bg-surface-3'"
          :aria-current="isSelected('', '') ? 'true' : undefined"
          data-pool="all"
          @click="navigate('', '')"
        >
          <Icon name="users" size="sm" class="shrink-0" aria-hidden="true" />
          <span>{{ t('admin.accounts.workspace.allAccounts') }}</span>
        </button>
        <button
          type="button"
          class="pool-link"
          :class="group === 'ungrouped' ? 'bg-primary-50 font-semibold text-primary-700' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'"
          :aria-current="group === 'ungrouped' ? 'true' : undefined"
          data-pool="ungrouped"
          @click="navigate('ungrouped', '')"
        >
          <Icon name="inbox" size="sm" class="shrink-0" aria-hidden="true" />
          <span>{{ t('admin.accounts.workspace.ungrouped') }}</span>
        </button>
      </div>

      <p v-if="loading && groups.length === 0" class="mt-3 px-2 text-xs leading-5 text-ink-2" role="status">
        {{ t('common.loading') }}
      </p>
      <div class="mt-3 space-y-0.5 border-t border-edge pt-3">
        <section v-for="section in sections" :key="section.platform">
          <h3
            class="platform-row"
            :class="isSelected('', section.platform)
              ? 'bg-primary-50 text-primary-700'
              : containsSelection(section) && !isExpanded(section.platform)
                ? 'text-primary-700 hover:bg-surface-3'
                : 'text-ink hover:bg-surface-3'"
          >
            <span v-if="section.platform === 'composite'" class="platform-target">
              <PlatformIcon platform="composite" size="sm" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate">{{ t('admin.accounts.workspace.compositePools') }}</span>
            </span>
            <button
              v-else
              type="button"
              class="platform-target"
              :aria-current="isSelected('', section.platform) ? 'true' : undefined"
              :data-platform="section.platform"
              @click="navigate('', section.platform)"
            >
              <PlatformIcon :platform="section.platform" size="sm" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate">{{ section.label }}</span>
            </button>
            <button
              v-if="section.groups.length && !searching"
              type="button"
              class="platform-toggle"
              :aria-expanded="isExpanded(section.platform)"
              :aria-controls="sectionId(section.platform)"
              :aria-label="t(isExpanded(section.platform) ? 'admin.accounts.workspace.collapsePlatform' : 'admin.accounts.workspace.expandPlatform', { platform: sectionLabel(section) })"
              :title="t('admin.accounts.workspace.poolCount', { count: section.groups.length })"
              :data-platform-toggle="section.platform"
              @click="toggleSection(section.platform)"
            >
              <span v-if="!isExpanded(section.platform)" class="text-[11px] font-medium tabular-nums">{{ section.groups.length }}</span>
              <Icon
                name="chevronRight"
                size="xs"
                class="transition-transform duration-150 motion-reduce:transition-none"
                :class="isExpanded(section.platform) ? 'rotate-90' : ''"
                aria-hidden="true"
              />
            </button>
          </h3>
          <ul v-if="section.groups.length && isExpanded(section.platform)" :id="sectionId(section.platform)" class="pool-tree">
            <li v-for="pool in section.groups" :key="pool.id">
              <button
                type="button"
                class="pool-link pool-link-group"
                :class="isSelected(String(pool.id), '') ? 'bg-primary-50 font-medium text-primary-700' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'"
                :aria-current="isSelected(String(pool.id), '') ? 'true' : undefined"
                :title="poolTitle(pool)"
                :data-pool="pool.id"
                @click="navigate(String(pool.id), '')"
              >
                <span class="pool-gauge" aria-hidden="true">
                  <svg v-if="!simple && loadRatio(pool.id) !== null" viewBox="0 0 16 16" class="h-3.5 w-3.5 -rotate-90">
                    <circle cx="8" cy="8" r="6" fill="none" stroke-width="2.5" class="stroke-edge-strong" />
                    <circle
                      v-if="(loadRatio(pool.id) ?? 0) > 0"
                      cx="8" cy="8" r="6" fill="none" stroke-width="2.5" stroke-linecap="round"
                      :class="(loadRatio(pool.id) ?? 0) >= 0.9 ? 'stroke-amber-500' : 'stroke-primary-500'"
                      :stroke-dasharray="`${gaugeArc(loadRatio(pool.id) ?? 0)} ${GAUGE_CIRCUMFERENCE}`"
                    />
                  </svg>
                  <span v-else class="h-1 w-1 rounded-full bg-current opacity-60" />
                </span>
                <span class="min-w-0 flex-1 truncate">{{ pool.name }}</span>
                <span class="shrink-0 text-xs tabular-nums" :class="isSelected(String(pool.id), '') ? 'text-primary-700' : 'text-ink-2'">
                  {{ knownCount(pool.account_count) }}
                </span>
                <span v-if="!simple" class="sr-only">{{ t('admin.accounts.workspace.concurrency') }}: {{ capacityValue(pool.id) }}</span>
              </button>
            </li>
          </ul>
        </section>
        <p v-if="sections.length === 0" class="px-2 text-xs leading-5 text-ink-2" role="status">
          {{ t(search.trim() ? 'admin.accounts.workspace.noMatchingPools' : 'admin.accounts.workspace.noPools') }}
        </p>
      </div>

    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CONCRETE_PLATFORM_OPTIONS } from '@/constants/platforms'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import type { AdminGroup, GroupPlatform } from '@/types'
import type { AccountWorkspaceCapacity } from '@/composables/useAccountWorkspace'

const props = defineProps<{
  groups: AdminGroup[]
  group: string
  platform: string
  capacities: Record<number, AccountWorkspaceCapacity>
  loading: boolean
  capacityError: boolean
  simple: boolean
}>()
const emit = defineEmits<{ navigate: [scope: { group: string; platform: string }] }>()
const { t } = useI18n()
const search = ref('')
const mobileOpen = ref(false)
const mobileTrigger = ref<HTMLButtonElement | null>(null)
const navigationId = `account-pool-navigation-${getCurrentInstance()?.uid}`

// Collapsed platform sections survive reloads; selection and search always reveal their pools.
const COLLAPSED_STORAGE_KEY = 'account-pool-collapsed-platforms'
const readCollapsed = () => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(COLLAPSED_STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(saved) ? saved.filter((value): value is string => typeof value === 'string') : [])
  } catch {
    return new Set<string>()
  }
}
const collapsed = ref<Set<string>>(readCollapsed())
const setCollapsed = (next: Set<string>) => {
  collapsed.value = next
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]))
  } catch {
    // Storage may be unavailable (private mode); the in-memory state still applies.
  }
}

type PoolSection = { platform: GroupPlatform; label: string; groups: AdminGroup[] }
const sections = computed<PoolSection[]>(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  const matches = props.groups.filter((pool) => !keyword || pool.name.toLocaleLowerCase().includes(keyword))
  const platforms = new Map<GroupPlatform, string>(CONCRETE_PLATFORM_OPTIONS.map((option) => [option.value, option.label]))
  for (const pool of props.groups) {
    if (!platforms.has(pool.platform)) platforms.set(pool.platform, pool.platform)
  }
  const result = Array.from(platforms, ([platform, label]) => ({
    platform,
    label,
    groups: matches.filter((pool) => pool.platform === platform)
  })).filter((section) => !keyword || section.groups.length > 0)
  // A composite pool selects its member accounts; it is never an account-platform filter.
  return [...result.filter((section) => section.platform !== 'composite'), ...result.filter((section) => section.platform === 'composite')]
})
const searching = computed(() => search.value.trim() !== '')
const collapsibleSections = computed(() => sections.value.filter((section) => section.groups.length > 0))
const allCollapsed = computed(() => collapsibleSections.value.every((section) => collapsed.value.has(section.platform)))
const selectedLabel = computed(() => {
  if (props.group === 'ungrouped') return t('admin.accounts.workspace.ungrouped')
  if (props.group) return props.groups.find((pool) => String(pool.id) === props.group)?.name ?? t('admin.accounts.workspace.selectedGroup', { id: props.group })
  return CONCRETE_PLATFORM_OPTIONS.find((option) => option.value === props.platform)?.label ?? (props.platform || t('admin.accounts.workspace.allAccounts'))
})

const isSelected = (group: string, platform: string) => props.group === group && (group !== '' || props.platform === platform)
const isExpanded = (platform: string) => searching.value || !collapsed.value.has(platform)
const containsSelection = (section: PoolSection) => section.groups.some((pool) => String(pool.id) === props.group)
const sectionLabel = (section: PoolSection) => section.platform === 'composite' ? t('admin.accounts.workspace.compositePools') : section.label
const sectionId = (platform: string) => `${navigationId}-${platform}`
const toggleSection = (platform: string) => {
  const next = new Set(collapsed.value)
  if (next.has(platform)) next.delete(platform)
  else next.add(platform)
  setCollapsed(next)
}
const toggleAll = () => {
  setCollapsed(allCollapsed.value ? new Set() : new Set([...collapsed.value, ...collapsibleSections.value.map((section) => section.platform)]))
}
// Reveal a selected pool hidden in a collapsed section (deep links, overview navigation).
watch(
  () => [props.group, props.groups] as const,
  ([group]) => {
    const platform = props.groups.find((pool) => String(pool.id) === group)?.platform
    if (!platform || !collapsed.value.has(platform)) return
    const next = new Set(collapsed.value)
    next.delete(platform)
    setCollapsed(next)
  },
  { immediate: true }
)

const knownCount = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) ? value : '—'
const knownCapacity = (id: number) => {
  const value = props.capacities[id]
  return !props.capacityError && value && Number.isFinite(value.concurrency_used) && Number.isFinite(value.concurrency_max) ? value : undefined
}
const capacityValue = (id: number) => {
  const value = knownCapacity(id)
  return value ? `${value.concurrency_used} / ${value.concurrency_max}` : '—'
}
// Pool load as a ring in the icon column: empty track when idle, a dot when unknown.
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 6
const loadRatio = (id: number) => {
  const value = knownCapacity(id)
  if (!value || value.concurrency_max <= 0) return null
  return Math.min(1, Math.max(0, value.concurrency_used / value.concurrency_max))
}
// Keep any non-zero load visible as at least a short arc.
const gaugeArc = (ratio: number) => Math.max(ratio, 0.08) * GAUGE_CIRCUMFERENCE
const poolTitle = (pool: AdminGroup) => {
  const lines = [pool.name, `${t('admin.accounts.workspace.groupMembers')}: ${knownCount(pool.account_count)}`]
  if (!props.simple) {
    lines.push(knownCapacity(pool.id)
      ? `${t('admin.accounts.workspace.concurrency')}: ${capacityValue(pool.id)}`
      : t('admin.accounts.workspace.summaryUnavailable'))
  }
  return lines.join('\n')
}
const closeDirectory = () => {
  if (!mobileOpen.value) return
  mobileOpen.value = false
  void nextTick(() => mobileTrigger.value?.focus())
}
const navigate = (group: string, platform: string) => {
  emit('navigate', { group, platform })
  closeDirectory()
}
</script>

<style scoped>
.pool-directory { @apply min-h-0 rounded-field border border-edge; }
@media (min-width: 1024px) {
  .pool-directory { overflow-y: auto; max-height: 100%; scrollbar-width: thin; scrollbar-color: rgb(var(--edge)) transparent; }
}
@media (max-width: 1023px) {
  .pool-directory nav { max-height: min(60dvh, 480px); overflow-y: auto; }
}
.pool-link {
  /* Keep clipped absolute labels inside the desktop and mobile scrollports. */
  position: relative;
  @apply flex min-h-9 w-full items-center gap-2 rounded-field px-2 py-2 text-left text-[13px] leading-5 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 motion-reduce:transition-none;
}
.directory-action {
  @apply shrink-0 rounded-md px-1.5 py-0.5 text-xs text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 motion-reduce:transition-none;
}

/* Platform heading: the label filters by platform, the chevron only folds its pools. */
.platform-row {
  position: relative;
  @apply flex min-h-[34px] items-center rounded-field text-[13px] font-semibold leading-5 transition-colors duration-150 motion-reduce:transition-none;
}
.platform-target {
  @apply flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-field py-1.5 pl-2 pr-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500;
}
.platform-toggle {
  @apply mr-1 flex h-7 min-w-7 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-ink-2 transition-colors duration-150 hover:bg-edge hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 motion-reduce:transition-none;
}

/* Pools align their names with the platform label; the icon column carries each pool's load ring. */
.pool-tree {
  @apply mb-1.5 mt-0.5 space-y-px;
}
.pool-link.pool-link-group {
  @apply min-h-8 py-1.5 pl-2 pr-2;
}
.pool-gauge {
  @apply flex h-3.5 w-3.5 shrink-0 items-center justify-center;
}
</style>
