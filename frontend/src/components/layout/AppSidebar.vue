<template>
  <aside
    class="sidebar"
    :class="[
      sidebarCollapsed ? 'w-[72px]' : 'w-[248px]',
      { '-translate-x-full lg:translate-x-0': !mobileOpen }
    ]"
  >
    <!-- Brand -->
    <div class="sidebar-header" :class="{ 'sidebar-header-collapsed': sidebarCollapsed }">
      <router-link
        :to="homePath"
        class="sidebar-logo flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-primary shadow-primary-outline transition-opacity hover:opacity-85"
        :aria-label="siteName"
        @click="handleMenuItemClick(homePath)"
      >
        <img v-if="settingsLoaded && siteLogo" :src="siteLogo" alt="" class="h-full w-full object-contain" />
        <span v-else class="text-[13px] font-extrabold tracking-[-0.04em] text-white">{{ logoInitials }}</span>
      </router-link>
      <div
        class="sidebar-brand"
        :class="{ 'sidebar-brand-collapsed': sidebarCollapsed }"
        :aria-hidden="sidebarCollapsed ? 'true' : 'false'"
      >
        <router-link
          :to="homePath"
          class="sidebar-brand-title text-[14.5px] font-bold tracking-[-0.02em] text-ink transition-colors hover:text-primary-600"
          @click="handleMenuItemClick(homePath)"
        >
          {{ siteName }}
        </router-link>
        <div class="mt-0.5 flex items-center gap-1.5">
          <VersionBadge :version="siteVersion" />
          <span v-if="isAdmin" class="rounded-[5px] bg-surface-3 px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
            ADMIN
          </span>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav ref="sidebarNavRef" class="sidebar-nav scrollbar-hide">
      <div v-for="(group, groupIndex) in navGroups" :key="group.key" class="sidebar-section">
        <div
          v-if="group.title && !(groupIndex === 0 && !group.title)"
          class="sidebar-section-title"
          :class="{ 'sidebar-section-title-collapsed': sidebarCollapsed }"
          :aria-hidden="sidebarCollapsed ? 'true' : 'false'"
        >
          <span
            class="sidebar-section-title-text"
            :class="{ 'sidebar-section-title-text-collapsed': sidebarCollapsed }"
          >
            {{ group.title }}
          </span>
        </div>

        <template v-for="item in group.items" :key="item.path">
          <!-- Collapsible group with children -->
          <template v-if="item.children?.length">
            <button
              type="button"
              class="sidebar-link w-full"
              :class="{
                'sidebar-link-active': isGroupActive(item) && !isGroupExpanded(item),
                'sidebar-link-collapsed': sidebarCollapsed
              }"
              :title="sidebarCollapsed ? item.label : undefined"
              :aria-expanded="isGroupExpanded(item)"
              @click="handleGroupClick(item)"
            >
              <component :is="item.icon" class="sidebar-link-icon" />
              <span
                class="sidebar-label sidebar-label-flex"
                :class="{ 'sidebar-label-collapsed': sidebarCollapsed }"
                :aria-hidden="sidebarCollapsed ? 'true' : 'false'"
              >
                <span class="min-w-0 truncate">{{ item.label }}</span>
                <ChevronDownIcon
                  class="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200"
                  :class="isGroupExpanded(item) ? 'rotate-180' : ''"
                />
              </span>
            </button>
            <div
              v-if="!sidebarCollapsed && isGroupExpanded(item)"
              class="sidebar-sub"
            >
              <router-link
                v-for="child in item.children"
                :key="child.path"
                :to="child.path"
                class="sidebar-link"
                :class="{ 'sidebar-link-active': isActive(child.path) }"
                @click="handleMenuItemClick(child.path)"
              >
                <component :is="child.icon" class="sidebar-link-icon" />
                <span class="min-w-0 truncate">{{ child.label }}</span>
                <span v-if="child.badge" class="sidebar-tail-count">{{ child.badge }}</span>
              </router-link>
            </div>
          </template>

          <!-- Leaf item -->
          <router-link
            v-else
            :to="item.path"
            class="sidebar-link"
            :class="{ 'sidebar-link-active': isActive(item.path), 'sidebar-link-collapsed': sidebarCollapsed }"
            :title="sidebarCollapsed ? item.label : undefined"
            :id="item.anchorId"
            :data-tour="item.path === '/keys' ? 'sidebar-my-keys' : undefined"
            @click="handleMenuItemClick(item.path)"
          >
            <span v-if="item.iconSvg" class="sidebar-svg-icon" v-html="sanitizeSvg(item.iconSvg)"></span>
            <component :is="item.icon" v-else class="sidebar-link-icon" />
            <span
              class="sidebar-label"
              :class="{ 'sidebar-label-collapsed': sidebarCollapsed }"
              :aria-hidden="sidebarCollapsed ? 'true' : 'false'"
            >{{ item.label }}</span>
            <span
              v-if="!sidebarCollapsed && item.count !== undefined && item.count > 0"
              class="sidebar-tail"
            >{{ item.count }}</span>
            <span
              v-else-if="!sidebarCollapsed && item.badge"
              class="sidebar-tail-count"
            >{{ item.badge }}</span>
            <span
              v-else-if="!sidebarCollapsed && item.dot"
              class="sidebar-tail"
            ><i class="h-1.5 w-1.5 rounded-full bg-amber-500" /></span>
          </router-link>
        </template>
      </div>
    </nav>

    <!-- Footer: quota meter + theme + collapse -->
    <div class="sidebar-footer">
      <div v-if="quotaMeter && !sidebarCollapsed" class="sidebar-meter">
        <div class="flex items-center justify-between">
          <span class="min-w-0 truncate text-meta font-semibold text-ink-2">{{ quotaMeter.title }}</span>
          <span class="ml-2 shrink-0 text-meta tabular-nums text-ink-3">{{ quotaMeter.percent }}%</span>
        </div>
        <div class="progress mt-2">
          <div
            class="progress-bar"
            :class="quotaMeter.tone === 'bad' ? 'progress-bar-bad' : quotaMeter.tone === 'warn' ? 'progress-bar-warn' : ''"
            :style="{ width: `${quotaMeter.percent}%` }"
          />
        </div>
        <div class="mt-1.5 truncate text-[11px] text-ink-3">{{ quotaMeter.caption }}</div>
      </div>

      <button
        type="button"
        class="sidebar-link sidebar-link-compact w-full"
        :class="{ 'sidebar-link-collapsed': sidebarCollapsed }"
        :title="sidebarCollapsed ? (isDark ? t('nav.lightMode') : t('nav.darkMode')) : undefined"
        @click="toggleTheme"
      >
        <SunIcon v-if="isDark" class="sidebar-link-icon text-amber-500" />
        <MoonIcon v-else class="sidebar-link-icon" />
        <span class="sidebar-label" :class="{ 'sidebar-label-collapsed': sidebarCollapsed }" :aria-hidden="sidebarCollapsed ? 'true' : 'false'">
          {{ isDark ? t('nav.lightMode') : t('nav.darkMode') }}
        </span>
      </button>

      <button
        type="button"
        class="sidebar-link sidebar-link-compact w-full"
        :class="{ 'sidebar-link-collapsed': sidebarCollapsed }"
        :title="sidebarCollapsed ? t('nav.expand') : t('nav.collapse')"
        @click="toggleSidebar"
      >
        <ChevronDoubleLeftIcon v-if="!sidebarCollapsed" class="sidebar-link-icon" />
        <ChevronDoubleRightIcon v-else class="sidebar-link-icon" />
        <span class="sidebar-label" :class="{ 'sidebar-label-collapsed': sidebarCollapsed }" :aria-hidden="sidebarCollapsed ? 'true' : 'false'">
          {{ sidebarCollapsed ? t('nav.expand') : t('nav.collapse') }}
        </span>
      </button>
    </div>
  </aside>

  <!-- Mobile Overlay -->
  <transition name="fade">
    <div v-if="mobileOpen" class="fixed inset-0 z-30 bg-slate-950/45 lg:hidden" @click="closeMobile"></div>
  </transition>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminSettingsStore, useAppStore, useAuthStore, useOnboardingStore, useSubscriptionStore } from '@/stores'
import VersionBadge from '@/components/common/VersionBadge.vue'
import { sanitizeSvg } from '@/utils/sanitize'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, makeSidebarFlag } from '@/utils/featureFlags'
import { resolveSiteBillingMode } from '@/utils/siteBillingMode'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'

/**
 * Navigation model
 * ----------------
 * Items are no longer a flat list. They are declared in business groups that
 * mirror the request lifecycle from the design doc (总览 → 流量 → 客户 → 系统),
 * plus a "my account" group for admin. Groups render their title as an
 * uppercase micro-label and keep the same item markup as leaves so a group
 * with a single child can be flattened without changing the click path.
 *
 * Visual differences from the old sidebar:
 *  - title + version live in a compact two-line brand block;
 *  - every row is 34px with a 18px icon, selected rows use the primary tint
 *    with no left bar (the bar collided with the collapsed state);
 *  - trailing counters (`tail`) show "how many" / "how many need attention".
 */
interface NavItem {
  path: string
  label: string
  icon: unknown
  iconSvg?: string
  hideInSimpleMode?: boolean
  children?: NavItem[]
  /**
   * When true, the parent item only toggles the expand/collapse state and
   * does NOT navigate to its `path`. The `path` is purely a stable key.
   */
  expandOnly?: boolean
  /**
   * 可选的功能开关 getter。返回 false 时菜单项被隐藏；返回 undefined/true 时显示。
   * 宽容策略（undefined → 显示）避免 public settings 未加载完成时菜单闪烁消失。
   * Getter 里访问的 reactive 来源（store / composable）会被 computed 自动追踪，
   * 开关切换时菜单自动更新。
   */
  featureFlag?: () => boolean | undefined
  /** Right-aligned counter, e.g. number of accounts in the pool. */
  count?: number
  /** Right-aligned attention badge (red pill). */
  badge?: number
  /** Small amber dot for "soft attention" without a number. */
  dot?: boolean
  /** Stable DOM id used by the onboarding tour. */
  anchorId?: string
}

interface NavGroup {
  key: string
  title?: string
  items: NavItem[]
}

// applyFeatureFlags 递归过滤掉 featureFlag() === false 的节点（含子节点）。
// 使用 `!== false` 宽容语义：undefined（设置未加载）或 true 都视为显示。
function applyFeatureFlags(items: NavItem[]): NavItem[] {
  const out: NavItem[] = []
  for (const item of items) {
    if (item.featureFlag && item.featureFlag() === false) continue
    if (item.children) {
      out.push({ ...item, children: applyFeatureFlags(item.children) })
    } else {
      out.push(item)
    }
  }
  return out
}

// filterGroups 丢弃被开关过滤后变空的分组，避免出现只有标题的空区块。
function filterGroups(groups: NavGroup[]): NavGroup[] {
  return groups
    .map((group) => ({ ...group, items: applyFeatureFlags(group.items) }))
    .filter((group) => group.items.length > 0)
}

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()
const onboardingStore = useOnboardingStore()
const adminSettingsStore = useAdminSettingsStore()
const subscriptionStore = useSubscriptionStore()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()

const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const mobileOpen = computed(() => appStore.mobileOpen)
const isAdmin = computed(() => authStore.isAdmin)
const sidebarNavRef = ref<HTMLElement | null>(null)
const isDark = ref(document.documentElement.classList.contains('dark'))

const homePath = computed(() => (isAdmin.value ? '/admin/dashboard' : '/dashboard'))

// Per-group expand/collapse overrides. A group with no entry follows the
// automatic behavior (expanded while the active route is one of its children);
// a chevron click records the user's choice, which wins over the automatic
// state so an active group can still be collapsed manually.
const groupExpandOverrides = ref<Map<string, boolean>>(new Map())

// Site settings from appStore (cached, no flicker)
const siteName = computed(() => appStore.siteName)
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const siteVersion = computed(() => appStore.siteVersion)
const settingsLoaded = computed(() => appStore.publicSettingsLoaded)
const logoInitials = computed(() => {
  const name = siteName.value.trim()
  if (!name) return 'S2'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
})

// ---- Quota meter (footer) -------------------------------------------------
// The spec puts "how much of my allowance is left" at the bottom of the
// sidebar where it is visible on every page.
// The meter puts "how much allowance is left" on every screen. Subscription
// limits are dollar-denominated (monthly window); without an active
// subscription we fall back to the wallet balance.
const quotaMeter = computed(() => {
  const sub = subscriptionStore.activeSubscriptions[0]
  const limit = Number(sub?.group?.monthly_limit_usd || 0)
  const used = Number(sub?.monthly_usage_usd || 0)

  if (limit > 0) {
    const percent = Math.min(100, Math.round((used / limit) * 100))
    return {
      title: t('nav.monthlyQuota', '本月额度'),
      percent,
      tone: percent >= 90 ? 'bad' : percent >= 75 ? 'warn' : 'ok',
      caption: `${formatMoney(used)} / ${formatMoney(limit)}`
    }
  }

  const balance = Number(authStore.user?.balance || 0)
  if (balance > 0) {
    return {
      title: t('nav.balance', '账户余额'),
      percent: 100,
      tone: 'ok',
      caption: formatMoney(balance)
    }
  }

  return null
})

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`
}

// ---- Icon components ------------------------------------------------------
const iconPath = (d: string) => ({
  render: () => h('svg', { fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '1.6' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d })
  ])
})

const DashboardIcon = iconPath(
  'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'
)
const KeyIcon = iconPath(
  'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z'
)
const BatchImageIcon = iconPath(
  'M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.25 2.25 0 00-1.906-1.059H9.554a2.25 2.25 0 00-1.906 1.059l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z'
)
const ChartIcon = iconPath(
  'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'
)
const ActivityIcon = iconPath('M3 12h3.75l2.25-6.75 4.5 13.5L15.75 12H21')
const GiftIcon = iconPath(
  'M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'
)
const UserIcon = iconPath(
  'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'
)
const UsersIcon = iconPath(
  'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z'
)
const UserPlusIcon = iconPath('M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z')
const FolderIcon = iconPath(
  'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
)
const ChannelIcon = iconPath(
  'M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0l4.179 2.25L12 17.25 2.25 12m15.321-2.25l4.179 2.25L12 17.25l-9.75-5.25'
)
const SignalIcon = iconPath('M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z')
const ServerIcon = iconPath(
  'M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3'
)
const PriceTagIcon = iconPath('M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z')
const CreditCardIcon = iconPath(
  'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z'
)
const RechargeSubscriptionIcon = iconPath('M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z M12 15.75l3-3m0 0l-3-3m3 3H6')
const OrderIcon = iconPath('M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z')
const OrderListIcon = OrderIcon
const TicketIcon = iconPath('M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z')
const ShieldIcon = iconPath('M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z')
const ClipboardIcon = iconPath('M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z')
const PlugIcon = iconPath('M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z')
const CogIcon = iconPath('M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z')
const BellIcon = iconPath('M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0')
const PluginIcon = PlugIcon
const GlobeIcon = iconPath('M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418')
const MoonIcon = iconPath('M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z')
const SunIcon = iconPath('M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z')
const ChevronDownIcon = iconPath('M19.5 8.25l-7.5 7.5-7.5-7.5')
const ChevronDoubleLeftIcon = iconPath('M18.75 4.5l-7.5 7.5 7.5 7.5m-6-15L5.25 12l7.5 7.5')
const ChevronDoubleRightIcon = iconPath('M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5')

// ---- Labels ---------------------------------------------------------------
// Purchase label follows the site billing mode (充值 / 订阅 / 充值·订阅).
const purchaseNavLabel = computed(() => {
  const mode = resolveSiteBillingMode(appStore.cachedPublicSettings)
  switch (mode) {
    case 'recharge_only':
      return t('nav.recharge')
    case 'subscription_only':
      return t('nav.subscribe')
    default:
      return t('nav.buySubscription')
  }
})

const flagAvailableChannels = makeSidebarFlag(FeatureFlags.availableChannels)
const flagChannelMonitor = makeSidebarFlag(FeatureFlags.channelMonitor)
const flagSubscription = makeSidebarFlag(FeatureFlags.subscription)
const flagPayment = makeSidebarFlag(FeatureFlags.payment)
const flagAffiliate = makeSidebarFlag(FeatureFlags.affiliate)
const flagRiskControl = makeSidebarFlag(FeatureFlags.riskControl)
const flagPluginManagement = makeSidebarFlag(FeatureFlags.pluginManagement)
const flagOpsMonitoring = () => adminSettingsStore.opsMonitoringEnabled
const flagAdminPayment = () => adminSettingsStore.paymentEnabled
const flagBatchImageAccess = () => canUseBatchImage.value

// ---- Self nav -------------------------------------------------------------
// 用户侧 12 项按业务语义分为四组：工作 / 服务 / 账务 / 账户。
// withDashboard=true 时包含工作台（用户端），false 时不含（管理员个人区）。
function buildSelfGroups(withDashboard: boolean): NavGroup[] {
  const work: NavItem[] = []
  if (withDashboard) {
    work.push({ path: '/dashboard', label: t('nav.dashboard'), icon: DashboardIcon })
  }
  work.push(
    { path: '/keys', label: t('nav.apiKeys'), icon: KeyIcon, anchorId: 'sidebar-my-keys' },
    {
      path: '/batch-image',
      label: t('nav.batchImage'),
      icon: BatchImageIcon,
      hideInSimpleMode: true,
      featureFlag: flagBatchImageAccess
    },
    { path: '/usage', label: t('nav.usage'), icon: ChartIcon, hideInSimpleMode: true }
  )

  const service: NavItem[] = [
    {
      path: '/available-channels',
      label: t('nav.availableChannels'),
      icon: ChannelIcon,
      hideInSimpleMode: true,
      featureFlag: flagAvailableChannels
    },
    { path: '/monitor', label: t('nav.channelStatus'), icon: SignalIcon, featureFlag: flagChannelMonitor },
    {
      path: '/subscriptions',
      label: t('nav.mySubscriptions'),
      icon: CreditCardIcon,
      hideInSimpleMode: true,
      featureFlag: flagSubscription
    }
  ]

  const billing: NavItem[] = [
    {
      path: '/purchase',
      label: purchaseNavLabel.value,
      icon: RechargeSubscriptionIcon,
      hideInSimpleMode: true,
      featureFlag: flagPayment
    },
    { path: '/orders', label: t('nav.myOrders'), icon: OrderListIcon, hideInSimpleMode: true, featureFlag: flagPayment },
    { path: '/redeem', label: t('nav.redeem'), icon: GiftIcon, hideInSimpleMode: true },
    { path: '/affiliate', label: t('nav.affiliate'), icon: UserPlusIcon, hideInSimpleMode: true, featureFlag: flagAffiliate }
  ]

  const account: NavItem[] = [
    { path: '/profile', label: t('nav.profile'), icon: UserIcon },
    ...customMenuItemsForUser.value.map(
      (item): NavItem => ({
        path: `/custom/${item.id}`,
        label: item.label,
        icon: null,
        iconSvg: item.icon_svg
      })
    )
  ]

  return [
    { key: 'work', title: t('nav.groupWork', '工作'), items: work },
    { key: 'service', title: t('nav.groupService', '服务'), items: service },
    { key: 'billing', title: t('nav.groupBilling', '账务'), items: billing },
    { key: 'account', title: undefined, items: account }
  ]
}

// finalizeNav 合并三重过滤：featureFlag 过滤 + simple 模式过滤。
function finalizeGroups(groups: NavGroup[]): NavGroup[] {
  const filtered = filterGroups(
    groups.map((group) => ({
      ...group,
      items: authStore.isSimpleMode ? group.items.filter((item) => !item.hideInSimpleMode) : group.items
    }))
  )
  return filtered
}

// User navigation (regular users)
const userNavGroups = computed((): NavGroup[] => finalizeGroups(buildSelfGroups(true)))

// Personal navigation (admin's "My Account" section, without the dashboard).
// Admins reach 可用渠道 from this section just like regular users — there is no
// separate admin entry, since the page is purely a user-facing view.
const personalNavGroups = computed((): NavGroup[] => finalizeGroups(buildSelfGroups(false)))

// Custom menu items filtered by visibility
const customMenuItemsForUser = computed(() => {
  const items = appStore.cachedPublicSettings?.custom_menu_items ?? []
  return items.filter((item) => item.visibility === 'user').sort((a, b) => a.sort_order - b.sort_order)
})

const customMenuItemsForAdmin = computed(() => {
  return adminSettingsStore.customMenuItems
    .filter((item) => item.visibility === 'admin')
    .sort((a, b) => a.sort_order - b.sort_order)
})

// ---- Admin nav ------------------------------------------------------------
// 22 项平铺 → 5 个业务分组 + 「我的账户」。
//  - 「渠道管理」折叠组被取消（只有 2 项，白白多一次点击）；
//  - 「账号管理」更名「账号池」，与渠道定价、分组定价同属「流量」；
//  - 「订单管理」三页合并到「客户」分组下（路由不变）。
const adminNavGroups = computed((): NavGroup[] => {
  const overview: NavItem[] = [
    { path: '/admin/dashboard', label: t('nav.dashboard'), icon: DashboardIcon },
    { path: '/admin/ops', label: t('nav.ops'), icon: ActivityIcon, featureFlag: flagOpsMonitoring, dot: true }
  ]

  const traffic: NavItem[] = [
    { path: '/admin/accounts', label: t('nav.accounts'), icon: ServerIcon, anchorId: 'sidebar-channel-manage' },
    { path: '/admin/groups', label: t('nav.groups'), icon: FolderIcon, anchorId: 'sidebar-group-manage' },
    { path: '/admin/channels/pricing', label: t('nav.channelPricing'), icon: PriceTagIcon, hideInSimpleMode: true },
    { path: '/admin/channels/monitor', label: t('nav.channelMonitor'), icon: SignalIcon, featureFlag: flagChannelMonitor },
    { path: '/admin/proxies', label: t('nav.proxies'), icon: GlobeIcon, hideInSimpleMode: true }
  ]

  const customers: NavItem[] = [
    { path: '/admin/users', label: t('nav.users'), icon: UsersIcon, hideInSimpleMode: true },
    // 「仅充值」站点连管理端的「订阅管理」入口也一并收起（路由本身不拦截）。
    {
      path: '/admin/subscriptions',
      label: t('nav.subscriptions'),
      icon: CreditCardIcon,
      hideInSimpleMode: true,
      featureFlag: flagSubscription
    },
    {
      path: '/admin/orders',
      label: t('nav.orderManagement'),
      icon: OrderIcon,
      hideInSimpleMode: true,
      featureFlag: flagAdminPayment,
      children: [
        { path: '/admin/orders/dashboard', label: t('nav.paymentDashboard'), icon: ChartIcon },
        { path: '/admin/orders', label: t('nav.ordersList', '订单列表'), icon: OrderListIcon },
        { path: '/admin/orders/plans', label: t('nav.paymentPlans'), icon: CreditCardIcon }
      ]
    },
    {
      path: '/admin/redeem',
      label: t('nav.redeemPromo', '兑换码 / 优惠码'),
      icon: TicketIcon,
      hideInSimpleMode: true,
      anchorId: 'sidebar-wallet',
      children: [
        { path: '/admin/redeem', label: t('nav.redeemCodes'), icon: TicketIcon },
        { path: '/admin/promo-codes', label: t('nav.promoCodes'), icon: GiftIcon }
      ]
    },
    {
      path: '/admin/affiliates',
      label: t('nav.affiliateManagement'),
      icon: UserPlusIcon,
      hideInSimpleMode: true,
      featureFlag: flagAffiliate,
      children: [
        { path: '/admin/affiliates/invites', label: t('nav.affiliateInviteRecords'), icon: UsersIcon },
        { path: '/admin/affiliates/rebates', label: t('nav.affiliateRebateRecords'), icon: OrderListIcon },
        { path: '/admin/affiliates/transfers', label: t('nav.affiliateTransferRecords'), icon: CreditCardIcon }
      ]
    }
  ]

  const system: NavItem[] = [
    {
      path: '/admin/security-audit',
      label: t('nav.securityAudit'),
      icon: ShieldIcon,
      hideInSimpleMode: true,
      featureFlag: flagRiskControl,
      children: [
        { path: '/admin/risk-control', label: t('nav.contentModeration'), icon: ShieldIcon },
        { path: '/admin/prompt-audit', label: t('nav.promptAudit'), icon: ShieldIcon }
      ]
    },
    { path: '/admin/audit-logs', label: t('nav.auditLogs'), icon: ClipboardIcon, hideInSimpleMode: true },
    { path: '/admin/usage', label: t('nav.usage'), icon: ChartIcon, hideInSimpleMode: true },
    { path: '/admin/announcements', label: t('nav.announcements'), icon: BellIcon, hideInSimpleMode: true },
    { path: '/admin/plugins', label: t('nav.plugins'), icon: PluginIcon, featureFlag: flagPluginManagement }
  ]

  const settings: NavItem[] = authStore.isSimpleMode
    ? [
        { path: '/keys', label: t('nav.apiKeys'), icon: KeyIcon },
        { path: '/admin/settings', label: t('nav.settings'), icon: CogIcon }
      ]
    : [
        { path: '/admin/settings', label: t('nav.settings'), icon: CogIcon },
        ...customMenuItemsForAdmin.value.map(
          (cm): NavItem => ({ path: `/custom/${cm.id}`, label: cm.label, icon: null, iconSvg: cm.icon_svg })
        )
      ]

  return filterGroups([
    { key: 'overview', title: t('nav.groupOverview', '总览'), items: overview },
    { key: 'traffic', title: t('nav.groupTraffic', '流量'), items: traffic },
    { key: 'customers', title: t('nav.groupCustomers', '客户'), items: customers },
    { key: 'system', title: t('nav.groupSystem', '系统'), items: settings.length ? [...system, ...settings] : system }
  ])
})

// Admin view: admin groups first, then a personal group (hidden in simple mode).
const navGroups = computed((): NavGroup[] => {
  if (isAdmin.value) {
    const groups = adminNavGroups.value.map((group) => ({ ...group }))
    if (!authStore.isSimpleMode) {
      const personal = personalNavGroups.value.flatMap((group) => group.items)
      if (personal.length > 0) {
        groups.push({ key: 'personal', title: t('nav.myAccount'), items: personal })
      }
    }
    return groups
  }
  if (appStore.backendModeEnabled) return []
  return userNavGroups.value
})

function toggleSidebar() {
  appStore.toggleSidebar()
}

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function closeMobile() {
  appStore.setMobileOpen(false)
}

function handleMenuItemClick(itemPath: string) {
  if (mobileOpen.value) {
    setTimeout(() => {
      appStore.setMobileOpen(false)
    }, 150)
  }

  // Map paths to tour selectors
  const pathToSelector: Record<string, string> = {
    '/admin/groups': '#sidebar-group-manage',
    '/admin/accounts': '#sidebar-channel-manage',
    '/keys': '[data-tour="sidebar-my-keys"]'
  }

  const selector = pathToSelector[itemPath]
  if (selector && onboardingStore.isCurrentStep(selector)) {
    onboardingStore.nextStep(500)
  }
}

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}

function isGroupActive(item: NavItem): boolean {
  if (!item.children) return false
  return item.children.some((child) => route.path === child.path)
}

function isGroupExpanded(item: NavItem): boolean {
  const override = groupExpandOverrides.value.get(item.path)
  if (override !== undefined) return override
  return isGroupActive(item)
}

function toggleGroup(item: NavItem) {
  groupExpandOverrides.value.set(item.path, !isGroupExpanded(item))
}

/**
 * Click handler for collapsible parent items.
 * - When sidebar is collapsed: do nothing (children are not visible).
 * - When `expandOnly` is true: only toggle expand state.
 * - Otherwise (default, e.g. /admin/orders): navigate to the parent path
 *   (router-link semantics) and ensure the group is expanded.
 */
function handleGroupClick(item: NavItem) {
  if (sidebarCollapsed.value) return
  if (item.expandOnly) {
    toggleGroup(item)
    return
  }
  // Push to path and ensure expanded
  if (route.path !== item.path) {
    void router.push(item.path)
  }
  groupExpandOverrides.value.set(item.path, true)
}

// Initialize theme
const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  isDark.value = true
  document.documentElement.classList.add('dark')
}

// Fetch admin settings (for feature-gated nav items like Ops).
watch(
  isAdmin,
  (v) => {
    if (v) {
      adminSettingsStore.fetch()
    }
  },
  { immediate: true }
)

onMounted(() => {
  void refreshBatchImageAccess()
  if (isAdmin.value) {
    adminSettingsStore.fetch()
  }
  // Restore sidebar scroll position after route change re-mounts the component
  if (appStore.sidebarScrollTop > 0 && sidebarNavRef.value) {
    void nextTick(() => {
      if (sidebarNavRef.value) {
        sidebarNavRef.value.scrollTop = appStore.sidebarScrollTop
      }
    })
  }
})

onBeforeUnmount(() => {
  if (sidebarNavRef.value) {
    appStore.sidebarScrollTop = sidebarNavRef.value.scrollTop
  }
})

defineExpose({ navGroups })
</script>

<style scoped>
.sidebar-logo {
  flex: 0 0 2rem;
  min-width: 2rem;
}

.sidebar-header-collapsed {
  gap: 0;
  padding-left: 1.125rem;
  padding-right: 1.125rem;
}

.sidebar-brand {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
  white-space: nowrap;
  transition:
    max-width 0.22s ease,
    opacity 0.14s ease,
    transform 0.14s ease;
  max-width: 12rem;
}

.sidebar-brand-collapsed {
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateX(-4px);
  pointer-events: none;
}

.sidebar-brand-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-link-collapsed {
  gap: 0;
  padding-left: 0.875rem;
  padding-right: 0.875rem;
}

.sidebar-link-compact {
  height: 32px;
  margin-bottom: 2px;
}

.sidebar-link-icon {
  height: 18px;
  width: 18px;
  flex-shrink: 0;
  color: rgb(var(--ink-3));
  transition: color 0.14s ease;
}

.sidebar-section-title {
  position: relative;
  display: flex;
  min-height: 1.25rem;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
}

.sidebar-section-title-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

/* Collapsed state: the group label becomes a hairline separator. */
.sidebar-section-title::after {
  content: '';
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  top: 50%;
  height: 1px;
  background: rgb(var(--edge));
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 0.18s ease;
}

.sidebar-section-title-text-collapsed {
  opacity: 0;
  transform: translateX(-4px);
}

.sidebar-section-title-collapsed::after {
  opacity: 1;
  transition-delay: 0.08s;
}

.sidebar-label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    max-width 0.2s ease,
    opacity 0.12s ease,
    transform 0.12s ease;
  max-width: 12rem;
}

.sidebar-label-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.sidebar-label-collapsed {
  max-width: 0;
  opacity: 0;
  transform: translateX(-4px);
  pointer-events: none;
}

/* Custom SVG icon in sidebar: constrain size without overriding uploaded SVG colors */
.sidebar-svg-icon {
  display: inline-flex;
  height: 1.125rem;
  width: 1.125rem;
  flex-shrink: 0;
  color: currentColor;
}

.sidebar-svg-icon :deep(svg) {
  display: block;
  width: 1.125rem;
  height: 1.125rem;
}
</style>
