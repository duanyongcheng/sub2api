<template>
  <header class="topbar">
    <!-- Left: mobile menu + page title / subtitle -->
    <div class="flex min-w-0 shrink items-center gap-3">
      <button
        class="btn-ghost btn-icon lg:hidden"
        :aria-label="t('common.toggleMenu')"
        @click="toggleMobileSidebar"
      >
        <Icon name="menu" size="md" />
      </button>

      <div class="topbar-title hidden lg:flex">
        <h1>{{ pageTitle }}</h1>
        <span v-if="pageDescription">{{ pageDescription }}</span>
      </div>
    </div>

    <!-- Middle: global search entry (visual affordance; pages own their search) -->
    <div
      v-if="user && !isMobileShell"
      class="topbar-search hidden xl:flex w-[300px]"
      role="search"
      :aria-label="t('common.search', '搜索')"
      :title="searchHint"
      @click="focusPageSearch"
    >
      <Icon name="search" size="sm" class="shrink-0" />
      <span class="grow truncate text-body text-ink-3">{{ searchPlaceholder }}</span>
      <kbd class="rounded-[5px] border border-edge bg-surface px-1.5 py-px font-mono text-[10px] text-ink-3">
        {{ shortcutLabel }}
      </kbd>
    </div>

    <!-- Right: announcements, docs, plaza, locale, subscription, balance, user -->
    <div class="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
      <AnnouncementBell v-if="user" />

      <a
        v-if="docUrl"
        :href="docUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="topbar-icon hidden sm:grid"
        :title="t('nav.docs')"
        :aria-label="t('nav.docs')"
      >
        <Icon name="book" size="sm" />
      </a>

      <router-link
        v-if="user && modelPlazaEnabled"
        :to="{ path: '/model-plaza', query: { embedded: '1' } }"
        :title="t('nav.modelPlaza')"
        :aria-label="t('nav.modelPlaza')"
        class="topbar-icon hidden sm:grid"
      >
        <Icon name="grid" size="sm" />
      </router-link>

      <LocaleSwitcher />

      <!-- Subscription progress (mounted only when the feature is on) -->
      <SubscriptionProgressMini v-if="user && subscriptionFeatureEnabled" />

      <!-- Balance -->
      <div v-if="user" class="group relative hidden sm:block">
        <div class="balance-pill">
          <Icon name="dollar" size="sm" />
          <span>{{ formatHeaderMoney(availableBalance) }}</span>
          <span
            v-if="frozenBalance > 0"
            class="rounded-full bg-amber-500/15 px-1.5 py-px text-[10.5px] font-bold text-amber-600"
          >
            {{ balanceFrozenLabel }}
          </span>
        </div>
        <div
          class="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden w-56 rounded-xl border border-edge bg-surface p-3 text-xs shadow-lg group-hover:block"
        >
          <div class="flex items-center justify-between">
            <span class="text-ink-3">{{ balanceAvailableText }}</span>
            <span class="font-semibold tabular-nums text-ink">{{ formatHeaderMoney(availableBalance) }}</span>
          </div>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-ink-3">{{ balanceFrozenText }}</span>
            <span class="font-semibold tabular-nums text-amber-600">{{ formatHeaderMoney(frozenBalance) }}</span>
          </div>
          <div class="mt-2 flex items-center justify-between border-t border-edge pt-2">
            <span class="text-ink-3">{{ balanceTotalText }}</span>
            <span class="font-bold tabular-nums text-ink">{{ formatHeaderMoney(totalBalance) }}</span>
          </div>
        </div>
      </div>

      <!-- User menu -->
      <div v-if="user" ref="dropdownRef" class="relative">
        <button
          class="user-chip"
          :aria-label="t('common.userMenu')"
          :aria-expanded="dropdownOpen"
          @click="toggleDropdown"
        >
          <span
            class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-slate-600 to-slate-900 text-[12px] font-bold text-white"
          >
            <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="h-full w-full object-cover" />
            <span v-else>{{ userInitials }}</span>
          </span>
          <span class="hidden flex-col text-left md:flex">
            <span class="user-chip-name">{{ displayName }}</span>
            <span class="user-chip-role">{{ user.email }}</span>
          </span>
          <Icon name="chevronDown" size="sm" class="hidden text-ink-3 md:block" />
        </button>

        <transition name="dropdown">
          <div v-if="dropdownOpen" class="dropdown right-0 mt-2 w-60">
            <div class="border-b border-edge px-4 py-3">
              <div class="text-body font-semibold text-ink">{{ displayName }}</div>
              <div class="mt-0.5 truncate text-meta text-ink-3">{{ user.email }}</div>
              <div class="mt-1.5 inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">
                {{ t('admin.users.roles.' + user.role) }}
              </div>
            </div>

            <!-- Balance (mobile only) -->
            <div class="border-b border-edge px-4 py-2 sm:hidden">
              <div class="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">{{ t('common.balance') }}</div>
              <div class="text-body font-bold text-primary-700">{{ formatHeaderMoney(availableBalance) }}</div>
              <div v-if="frozenBalance > 0" class="mt-0.5 text-meta text-amber-600">
                {{ balanceFrozenText }} {{ formatHeaderMoney(frozenBalance) }}
              </div>
            </div>

            <div class="py-1">
              <router-link to="/profile" class="dropdown-item" @click="closeDropdown">
                <Icon name="user" size="sm" />
                {{ t('nav.profile') }}
              </router-link>
              <router-link to="/keys" class="dropdown-item" @click="closeDropdown">
                <Icon name="key" size="sm" />
                {{ t('nav.apiKeys') }}
              </router-link>
              <a
                v-if="authStore.isAdmin"
                href="https://github.com/Wei-Shaw/sub2api"
                target="_blank"
                rel="noopener noreferrer"
                class="dropdown-item"
                @click="closeDropdown"
              >
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                  />
                </svg>
                {{ t('nav.github') }}
              </a>
            </div>

            <div v-if="contactInfo" class="border-t border-edge px-4 py-2.5">
              <div class="flex items-center gap-1.5 text-meta text-ink-3">
                <Icon name="chat" size="xs" class="shrink-0" />
                <span>{{ t('common.contactSupport') }}:</span>
                <span class="truncate font-semibold text-ink-2">{{ contactInfo }}</span>
              </div>
            </div>

            <div v-if="showOnboardingButton" class="border-t border-edge py-1">
              <button class="dropdown-item w-full" @click="handleReplayGuide">
                <Icon name="lightbulb" size="sm" />
                {{ $t('onboarding.restartTour') }}
              </button>
            </div>

            <div class="border-t border-edge py-1">
              <button
                class="dropdown-item w-full text-red-600 hover:bg-red-500/10 hover:text-red-700"
                @click="handleLogout"
              >
                <Icon name="login" size="sm" />
                {{ t('nav.logout') }}
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore, useOnboardingStore } from '@/stores'
import { useAdminSettingsStore } from '@/stores/adminSettings'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import SubscriptionProgressMini from '@/components/common/SubscriptionProgressMini.vue'
import AnnouncementBell from '@/components/common/AnnouncementBell.vue'
import Icon from '@/components/icons/Icon.vue'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { resolveRouteMetaKeys } from '@/router/title'
import { resolveSiteBillingMode } from '@/utils/siteBillingMode'

/**
 * AppHeader — the 64px top bar.
 *
 * Contents follow the spec: page title + one-line subtitle on the left, a
 * global-search affordance in the middle, then notifications / docs / plaza /
 * locale / subscription / balance / user. The balance is a `balance-pill`
 * (brand tint, tabular numerals) rather than the old inline widget.
 */
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const adminSettingsStore = useAdminSettingsStore()
const onboardingStore = useOnboardingStore()

const user = computed(() => authStore.user)
const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const contactInfo = computed(() => appStore.contactInfo)
const docUrl = computed(() => sanitizeUrl(appStore.docUrl))
const modelPlazaEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza))
const avatarUrl = computed(() => user.value?.avatar_url?.trim() || '')
const availableBalance = computed(() => Number(user.value?.balance || 0))
const frozenBalance = computed(() => Number(user.value?.frozen_balance || 0))
const totalBalance = computed(() => availableBalance.value + frozenBalance.value)
const balanceAvailableText = computed(() => t('common.availableBalance'))
const balanceFrozenText = computed(() => t('common.frozenBalance'))
const balanceTotalText = computed(() => t('common.totalBalance'))
const balanceFrozenLabel = computed(() => formatHeaderMoney(frozenBalance.value))

// The global search box is an affordance: pressing it (or ⌘K / Ctrl+K) focuses
// the current page's search field instead of opening a second, competing
// search surface.
const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const shortcutLabel = isMac ? '⌘K' : 'Ctrl K'
const searchPlaceholder = computed(() => t('nav.globalSearch'))
const searchHint = computed(() => t('nav.globalSearchHint'))
const isMobileShell = ref(typeof window !== 'undefined' ? window.innerWidth < 420 : false)

function focusPageSearch() {
  const candidates = document.querySelectorAll<HTMLElement>(
    '[data-page-search] input, main input[type="search"], main input[type="text"]'
  )
  const target = candidates[0]
  if (target) {
    target.focus()
    ;(target as HTMLInputElement).select?.()
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    focusPageSearch()
  }
}

function onResize() {
  isMobileShell.value = window.innerWidth < 420
}

// Only admins in standard mode can replay the onboarding tour.
const showOnboardingButton = computed(() => {
  return !authStore.isSimpleMode && user.value?.role === 'admin'
})

const userInitials = computed(() => {
  if (!user.value) return ''
  if (user.value.username) return user.value.username.substring(0, 2).toUpperCase()
  if (user.value.email) return user.value.email.split('@')[0].substring(0, 2).toUpperCase()
  return ''
})

const displayName = computed(() => {
  if (!user.value) return ''
  return user.value.username || user.value.email?.split('@')[0] || ''
})

// 订阅功能关闭时不挂载顶栏订阅徽章（组件 onMounted 会拉取订阅接口）。
const subscriptionFeatureEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.subscription))

// /purchase 的标题/描述随站点计费模式切换，与 document.title 共用同一解析。
const routeMetaKeys = computed(() =>
  resolveRouteMetaKeys(route, {
    billingMode: resolveSiteBillingMode(appStore.cachedPublicSettings)
  })
)

const pageTitle = computed(() => {
  // For custom pages, use the menu item's label instead of generic "自定义页面"
  if (route.name === 'CustomPage') {
    const id = route.params.id as string
    const publicItems = appStore.cachedPublicSettings?.custom_menu_items ?? []
    const menuItem =
      publicItems.find((item) => item.id === id) ??
      (authStore.isAdmin ? adminSettingsStore.customMenuItems.find((item) => item.id === id) : undefined)
    if (menuItem?.label) return menuItem.label
  }
  const titleKey = routeMetaKeys.value.titleKey
  if (titleKey) return t(titleKey)
  return (route.meta.title as string) || ''
})

const pageDescription = computed(() => {
  const descKey = routeMetaKeys.value.descriptionKey
  if (descKey) return t(descKey)
  return (route.meta.description as string) || ''
})

function toggleMobileSidebar() {
  appStore.toggleMobileSidebar()
}

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown() {
  dropdownOpen.value = false
}

async function handleLogout() {
  closeDropdown()
  try {
    await authStore.logout()
  } catch (error) {
    // Ignore logout errors - still redirect to login
    console.error('Logout error:', error)
  }
  await router.push('/login')
}

function handleReplayGuide() {
  closeDropdown()
  onboardingStore.replay()
}

function formatHeaderMoney(value: number) {
  if (!Number.isFinite(value)) return '$0.00'
  return `$${value.toFixed(2)}`
}

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.18s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(-4px);
}
</style>
