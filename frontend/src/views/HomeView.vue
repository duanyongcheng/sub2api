<template>
  <!-- Custom Home Content: Full Page Mode -->
  <div v-if="hasHomeContent" class="min-h-screen">
    <!-- iframe mode -->
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      class="h-screen w-full border-0"
      allowfullscreen
    ></iframe>
    <!-- HTML mode - SECURITY: homeContent is admin-only setting, XSS risk is acceptable -->
    <div v-else v-html="homeContent"></div>
  </div>

  <!-- Compact Home Page -->
  <div
    v-else-if="compactHomeEnabled"
    data-testid="compact-home"
    :class="[
      'home-compact-shell flex min-h-screen flex-col bg-canvas text-ink',
      { 'home-theme-dark': isDark }
    ]"
  >
    <div class="home-compact-accent h-1 w-full shrink-0" aria-hidden="true"></div>
    <header class="relative z-30 border-b border-edge bg-surface px-4 py-3 sm:px-6 sm:py-3.5">
      <nav class="mx-auto flex max-w-5xl items-center justify-between gap-2 sm:gap-4">
        <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[9px] border border-primary-500/25 bg-primary-50 p-1 sm:h-9 sm:w-9 sm:rounded-[10px]"
          >
            <img
              :src="siteLogo || '/logo.svg'"
              alt="Logo"
              class="h-full w-full object-contain"
            />
          </span>
          <span class="min-w-0 truncate text-[14.5px] font-bold tracking-[-0.015em] text-ink sm:text-[15px]">
            {{ siteName }}
          </span>
        </div>
        <div class="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <LocaleSwitcher />
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost btn-icon btn-sm sm:h-9 sm:w-9"
            :title="t('home.viewDocs')"
            :aria-label="t('home.viewDocs')"
          >
            <Icon name="book" size="md" />
          </a>
          <router-link
            v-if="showModelPlazaEntry"
            to="/model-plaza"
            class="btn btn-ghost h-8 px-2 text-sm sm:h-9 sm:px-2.5"
            :title="t('nav.modelPlaza')"
          >
            <Icon name="grid" size="md" />
            <span class="hidden sm:inline">{{ t('nav.modelPlaza') }}</span>
          </router-link>
          <button
            type="button"
            class="btn btn-ghost btn-icon btn-sm sm:h-9 sm:w-9"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            @click="toggleTheme"
          >
            <Icon v-if="isDark" name="sun" size="md" />
            <Icon v-else name="moon" size="md" />
          </button>
          <router-link
            :to="primaryDestination"
            class="btn btn-secondary h-8 px-2.5 text-[13px] sm:h-9 sm:px-3.5 sm:text-[13.5px]"
          >
            {{ isAuthenticated ? t('home.dashboard') : t('home.login') }}
          </router-link>
        </div>
      </nav>
    </header>

    <main class="flex min-w-0 flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div
        class="home-compact-card w-full min-w-0 max-w-xl overflow-hidden rounded-shell border border-edge bg-surface text-center shadow-sm"
      >
        <div class="border-b border-edge bg-primary-50 px-6 pb-6 pt-8 sm:px-10 sm:pt-9">
          <div
            class="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-card border border-primary-500/25 bg-surface p-2.5 shadow-xs"
          >
            <img
              :src="siteLogo || '/logo.svg'"
              alt="Logo"
              class="h-full w-full object-contain"
            />
          </div>
          <h1 class="[overflow-wrap:anywhere] text-2xl font-bold tracking-[-0.025em] text-ink sm:text-3xl">
            {{ siteName }}
          </h1>
          <p class="mx-auto mt-2.5 max-w-md whitespace-pre-wrap [overflow-wrap:anywhere] text-[14.5px] leading-relaxed text-ink-2">
            {{ compactSubtitle }}
          </p>
        </div>
        <div class="px-6 pb-9 pt-6 sm:px-10 sm:pb-10">
          <div class="flex flex-wrap items-center justify-center gap-2">
            <span
              v-for="node in passNodes"
              :key="node.id"
              class="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700"
            >
              <PlatformIcon :platform="node.id" size="xs" :class="platformIconClass(node.id)" />
              <span>{{ node.name }}</span>
            </span>
          </div>
          <router-link
            :to="primaryDestination"
            class="btn home-btn-teal btn-lg mt-6 px-6 text-white"
          >
            <span>{{ isAuthenticated ? t('home.goToDashboard') : t('home.login') }}</span>
            <Icon name="arrowRight" size="sm" :stroke-width="2" />
          </router-link>
        </div>
      </div>
    </main>

    <footer
      class="min-w-0 border-t border-edge bg-surface px-4 py-4 text-center text-[13px] text-ink-2 [overflow-wrap:anywhere] sm:px-6"
    >
      &copy; {{ currentYear }} {{ siteName }}
    </footer>
  </div>

  <!-- Default Home Page: Teal Masthead & Unified AI Pass -->
  <div
    v-else
    :class="[
      'home-shell flex min-h-screen flex-col bg-canvas text-ink',
      { 'home-theme-dark': isDark }
    ]"
  >
    <!-- Upper Deep-Teal Masthead -->
    <div class="home-masthead relative text-white">
      <!-- Top Navigation -->
      <header class="relative z-30 px-4 py-3.5 sm:px-6 sm:py-4">
        <nav class="mx-auto flex max-w-5xl items-center justify-between gap-2 sm:gap-3">
          <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-white/14 p-1 ring-1 ring-white/20 sm:h-9 sm:w-9 sm:rounded-[10px]"
            >
              <img :src="siteLogo || '/logo.svg'" alt="Logo" class="h-full w-full object-contain" />
            </span>
            <span class="min-w-0 truncate text-[14.5px] font-bold tracking-[-0.015em] text-white sm:text-[15px]">
              {{ siteName }}
            </span>
          </div>

          <div class="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
            <LocaleSwitcher variant="on-brand" />

            <a
              v-if="docUrl"
              :href="docUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#e6fbf7] transition-colors hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:h-9 sm:w-9"
              :title="t('home.viewDocs')"
              :aria-label="t('home.viewDocs')"
            >
              <Icon name="book" size="md" />
            </a>

            <router-link
              v-if="showModelPlazaEntry"
              to="/model-plaza"
              class="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[#e6fbf7] transition-colors hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:h-9 sm:px-2.5"
              :title="t('nav.modelPlaza')"
            >
              <Icon name="grid" size="md" />
              <span class="hidden sm:inline">{{ t('nav.modelPlaza') }}</span>
            </router-link>

            <button
              type="button"
              @click="toggleTheme"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#e6fbf7] transition-colors hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:h-9 sm:w-9"
              :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
              :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            >
              <Icon v-if="isDark" name="sun" size="md" />
              <Icon v-else name="moon" size="md" />
            </button>

            <router-link
              v-if="isAuthenticated"
              :to="dashboardPath"
              class="inline-flex h-8 items-center gap-1.5 rounded-field bg-white px-2.5 text-[12.5px] font-semibold text-[#0b4f4a] shadow-xs transition-colors hover:bg-[#f0fdfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d6860] sm:h-9 sm:gap-2 sm:px-3 sm:text-[13px]"
            >
              <span
                v-if="userInitial"
                class="flex h-5 w-5 items-center justify-center rounded-full bg-[#0d746c] text-[11px] font-bold text-white"
              >
                {{ userInitial }}
              </span>
              <span>{{ t('home.dashboard') }}</span>
            </router-link>
            <router-link
              v-else
              to="/login"
              class="inline-flex h-8 items-center justify-center rounded-field bg-white px-2.5 text-[12.5px] font-semibold text-[#0b4f4a] shadow-xs transition-colors hover:bg-[#f0fdfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d6860] sm:h-9 sm:px-3.5 sm:text-[13px]"
            >
              {{ t('home.login') }}
            </router-link>
          </div>
        </nav>
      </header>

      <!-- Centered Hero Introduction -->
      <div class="relative z-10 mx-auto max-w-4xl px-4 pb-28 pt-7 text-center sm:px-6 sm:pb-32 sm:pt-10">
        <h1
          class="mx-auto max-w-3xl text-[26px] font-bold leading-[1.24] tracking-[-0.03em] text-white sm:text-4xl lg:text-[42px]"
        >
          <span class="inline-block">{{ heroPrimaryClause }}</span>
          <span v-if="heroSecondaryClause" class="inline-block">{{ heroSecondaryClause }}</span>
        </h1>
        <p
          v-if="hasCustomSubtitle"
          class="mx-auto mt-3.5 max-w-2xl whitespace-pre-wrap text-pretty text-[15.5px] font-medium leading-[1.6] text-white"
        >
          {{ customSiteSubtitle }}
        </p>
        <p
          class="mx-auto max-w-2xl text-pretty text-[14.5px] leading-[1.68] text-[#e6fbf7] sm:text-[15.5px]"
          :class="hasCustomSubtitle ? 'mt-2' : 'mt-4'"
        >
          {{ t('home.heroDescription') }}
        </p>

        <div class="mt-7 flex items-center justify-center">
          <router-link
            :to="primaryDestination"
            class="home-masthead-cta inline-flex h-11 items-center justify-center gap-2 rounded-field bg-white px-6 text-[14px] font-semibold text-[#0b4f4a] transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-[#f0fdfa] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d6860]"
          >
            <span>{{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}</span>
            <Icon name="arrowRight" size="sm" :stroke-width="2" />
          </router-link>
        </div>
      </div>
    </div>

    <!-- Main Body Straddling the Masthead Seam -->
    <main class="relative z-20 flex-1 px-4 pb-16 sm:px-6 sm:pb-20">
      <div class="mx-auto max-w-5xl">
        <!-- Horizon-Bridging Unified AI Pass Panel -->
        <section
          class="home-pass-panel -mt-20 overflow-hidden rounded-shell border border-edge bg-surface sm:-mt-24"
        >
          <!-- Upper Routing Stage -->
          <div class="px-5 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-7">
            <h2 class="text-center text-lg font-bold tracking-[-0.02em] text-ink sm:text-[20px]">
              {{ t('home.pass.title') }}
            </h2>

            <!-- Connected Flagship Provider Rail -->
            <div class="relative mx-auto mt-5 max-w-3xl">
              <div
                class="home-pass-rail pointer-events-none absolute inset-x-[10%] top-1/2 hidden h-[6px] -translate-y-1/2 sm:block"
                aria-hidden="true"
              ></div>

              <div
                role="tablist"
                :aria-label="t('home.pass.title')"
                class="relative z-10 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3.5"
              >
                <button
                  v-for="(node, index) in passNodes"
                  :key="node.id"
                  :ref="(el) => setPassTabRef(el, index)"
                  type="button"
                  role="tab"
                  :id="`pass-tab-${node.id}`"
                  :aria-selected="activePassPlatform === node.id"
                  :aria-controls="`pass-panel-${node.id}`"
                  :tabindex="activePassPlatform === node.id ? 0 : -1"
                  class="home-pass-pill flex min-h-[44px] items-center justify-center gap-2.5 rounded-field border px-3.5 py-2 text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  :class="
                    activePassPlatform === node.id
                      ? 'border-primary-600 bg-primary-50 text-ink shadow-xs ring-1 ring-primary-500/25'
                      : 'border-edge-strong bg-surface text-ink hover:border-primary-500/50 hover:bg-surface-2'
                  "
                  @click="activePassPlatform = node.id"
                  @keydown="onPassTabKeydown($event, index)"
                >
                  <span
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    :class="platformBadgeLightClass(node.id)"
                  >
                    <PlatformIcon :platform="node.id" size="sm" />
                  </span>
                  <span class="truncate">{{ node.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Active Route Readout Strip -->
          <div
            :id="`pass-panel-${activePassNode.id}`"
            role="tabpanel"
            :aria-labelledby="`pass-tab-${activePassNode.id}`"
            class="border-t border-edge bg-surface-2 px-5 py-3.5 text-[13px] sm:px-8"
          >
            <div
              :key="activePassNode.id"
              class="home-pass-readout flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div class="flex items-center gap-2 font-semibold text-ink">
                <PlatformIcon
                  :platform="activePassNode.id"
                  size="sm"
                  :class="platformIconClass(activePassNode.id)"
                />
                <span>{{ activePassNode.protocol }}</span>
              </div>
              <p class="text-ink-2 sm:text-right">
                {{ activePassNode.summary }}
              </p>
            </div>
          </div>

          <!-- Lower Band: Three Core Value Pillars -->
          <div
            class="grid grid-cols-1 divide-y divide-edge border-t border-edge md:grid-cols-3 md:divide-x md:divide-y-0"
          >
            <div
              v-for="pillar in corePillars"
              :key="pillar.title"
              class="px-5 py-5 sm:px-7 sm:py-6"
            >
              <div class="flex items-center gap-2.5">
                <Icon
                  :name="pillar.icon"
                  size="md"
                  class="shrink-0 text-primary-600"
                  :stroke-width="1.75"
                />
                <h3 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                  {{ pillar.title }}
                </h3>
              </div>
              <p class="mt-2 text-[13.5px] leading-[1.65] text-ink-2">
                {{ pillar.description }}
              </p>
            </div>
          </div>
        </section>

        <!-- Supported AI Models & Ecosystem Matrix -->
        <section class="mt-14 sm:mt-16">
          <div class="mb-6 flex flex-col gap-1.5 sm:mb-7">
            <h2 class="text-xl font-bold tracking-[-0.025em] text-ink sm:text-[22px]">
              {{ t('home.ecosystem.title') }}
            </h2>
            <p class="text-[14px] leading-relaxed text-ink-2">
              {{ t('home.ecosystem.subtitle') }}
            </p>
          </div>

          <div
            class="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-edge bg-edge shadow-xs sm:grid-cols-4"
          >
            <div
              v-for="provider in ecosystemProviders"
              :key="provider.id"
              class="flex items-start gap-3 bg-surface px-4 py-4 transition-colors duration-150 hover:bg-surface-2 sm:px-5 sm:py-4"
            >
              <span
                class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                :class="platformBadgeLightClass(provider.id)"
              >
                <PlatformIcon :platform="provider.id" size="md" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-[14px] font-semibold text-ink">
                  {{ provider.label }}
                </div>
                <div class="mt-0.5 text-[12.5px] leading-snug text-ink-2">
                  {{ provider.detail }}
                </div>
              </div>
            </div>
          </div>

          <p class="mt-3.5 text-[13px] leading-relaxed text-ink-2">
            {{ t('home.ecosystem.compatibilityNote') }}
          </p>
        </section>

        <!-- Restrained Closing Action Strip -->
        <section
          class="mt-12 flex flex-col items-start justify-between gap-4 rounded-card border border-edge bg-surface px-5 py-5 shadow-xs sm:mt-14 sm:flex-row sm:items-center sm:px-7 sm:py-6"
        >
          <div class="min-w-0">
            <h2 class="text-[16px] font-bold tracking-[-0.015em] text-ink sm:text-[17px]">
              {{ t('home.closing.title') }}
            </h2>
            <p class="mt-1 text-[13.5px] leading-relaxed text-ink-2">
              {{ t('home.closing.description') }}
            </p>
          </div>
          <router-link
            :to="primaryDestination"
            class="btn home-btn-teal h-10 shrink-0 px-5 text-white"
          >
            <span>{{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}</span>
            <Icon name="arrowRight" size="sm" :stroke-width="2" />
          </router-link>
        </section>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-edge bg-surface px-4 py-6 sm:px-6">
      <div
        class="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left"
      >
        <p class="text-[13px] text-ink-2">
          &copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}
        </p>
        <div class="flex items-center gap-5">
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[13px] font-medium text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
          >
            {{ t('home.docs') }}
          </a>
          <a
            :href="githubUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[13px] font-medium text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import Icon from '@/components/icons/Icon.vue'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { platformBadgeLightClass, platformIconClass } from '@/utils/platformColors'

type PassPlatformId = 'anthropic' | 'openai' | 'gemini' | 'antigravity'
type EcosystemPlatformId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'antigravity'
  | 'deepseek'
  | 'grok'
  | 'kimi'
  | 'zhipu'

const DEFAULT_FALLBACK_SUBTITLE = 'AI API Gateway Platform'

const { t } = useI18n()

const authStore = useAuthStore()
const appStore = useAppStore()

// Site settings - directly from appStore (already initialized from injected config)
const siteName = computed(
  () => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API'
)
const siteLogo = computed(() =>
  sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '', {
    allowRelative: true,
    allowDataUrl: true
  })
)
const customSiteSubtitle = computed(
  () => appStore.cachedPublicSettings?.site_subtitle?.trim() || ''
)
const hasCustomSubtitle = computed(
  () =>
    customSiteSubtitle.value.length > 0 &&
    customSiteSubtitle.value !== DEFAULT_FALLBACK_SUBTITLE
)
const compactSubtitle = computed(() =>
  hasCustomSubtitle.value ? customSiteSubtitle.value : t('home.heroSubtitle')
)
const heroPrimaryClause = computed(() => {
  const subtitle = t('home.heroSubtitle')
  const zhSplit = subtitle.indexOf('，')
  if (zhSplit >= 0) {
    return `${siteName.value} · ${subtitle.slice(0, zhSplit + 1)}`
  }
  return `${siteName.value} ·\u00A0`
})
const heroSecondaryClause = computed(() => {
  const subtitle = t('home.heroSubtitle')
  const zhSplit = subtitle.indexOf('，')
  if (zhSplit >= 0) {
    return subtitle.slice(zhSplit + 1)
  }
  return subtitle
})
const docUrl = computed(() =>
  sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || '')
)
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')
const hasHomeContent = computed(() => homeContent.value.trim().length > 0)
const compactHomeEnabled = computed(
  () => appStore.cachedPublicSettings?.compact_home_enabled === true
)
const modelPlazaEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza))

// Check if homeContent is a URL (for iframe display)
const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

// Theme
const isDark = ref(document.documentElement.classList.contains('dark'))

// GitHub URL
const githubUrl = 'https://github.com/duanyongcheng/sub2api'

// Auth state
const isAuthenticated = computed(() => authStore.isAuthenticated)
const modelPlazaRequiresAuth = computed(
  () => appStore.cachedPublicSettings?.model_plaza_require_auth === true
)
const showModelPlazaEntry = computed(
  () => modelPlazaEnabled.value && (isAuthenticated.value || !modelPlazaRequiresAuth.value)
)
const isAdmin = computed(() => authStore.isAdmin)
const dashboardPath = computed(() => (isAdmin.value ? '/admin/dashboard' : '/dashboard'))
const primaryDestination = computed(() =>
  isAuthenticated.value ? dashboardPath.value : '/login'
)
const userInitial = computed(() => {
  const user = authStore.user
  if (!user || !user.email) return ''
  return user.email.charAt(0).toUpperCase()
})

// Unified AI Pass interactive state (pure local UI state, zero backend requests)
const activePassPlatform = ref<PassPlatformId>('openai')
const passTabRefs = ref<Array<HTMLButtonElement | null>>([])

function setPassTabRef(
  el: Element | ComponentPublicInstance | null,
  index: number
) {
  passTabRefs.value[index] = el instanceof HTMLButtonElement ? el : null
}

const passNodes = computed<
  Array<{
    id: PassPlatformId
    name: string
    protocol: string
    summary: string
  }>
>(() => [
  {
    id: 'anthropic',
    name: t('home.pass.nodes.anthropic.name'),
    protocol: t('home.pass.nodes.anthropic.protocol'),
    summary: t('home.pass.nodes.anthropic.summary')
  },
  {
    id: 'openai',
    name: t('home.pass.nodes.openai.name'),
    protocol: t('home.pass.nodes.openai.protocol'),
    summary: t('home.pass.nodes.openai.summary')
  },
  {
    id: 'gemini',
    name: t('home.pass.nodes.gemini.name'),
    protocol: t('home.pass.nodes.gemini.protocol'),
    summary: t('home.pass.nodes.gemini.summary')
  },
  {
    id: 'antigravity',
    name: t('home.pass.nodes.antigravity.name'),
    protocol: t('home.pass.nodes.antigravity.protocol'),
    summary: t('home.pass.nodes.antigravity.summary')
  }
])

const activePassIndex = computed(() => {
  const idx = passNodes.value.findIndex((node) => node.id === activePassPlatform.value)
  return idx >= 0 ? idx : 0
})

const activePassNode = computed(
  () => passNodes.value[activePassIndex.value] ?? passNodes.value[0]
)

function onPassTabKeydown(event: KeyboardEvent, currentIndex: number) {
  const count = passNodes.value.length
  if (!count) return

  let nextIndex = -1
  if (event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % count
  } else if (event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + count) % count
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = count - 1
  }

  if (nextIndex >= 0) {
    event.preventDefault()
    activePassPlatform.value = passNodes.value[nextIndex].id
    passTabRefs.value[nextIndex]?.focus()
  }
}

const corePillars = computed(() => [
  {
    icon: 'key' as const,
    title: t('home.pillars.unifiedTitle'),
    description: t('home.pillars.unifiedDesc')
  },
  {
    icon: 'shield' as const,
    title: t('home.pillars.stableTitle'),
    description: t('home.pillars.stableDesc')
  },
  {
    icon: 'chart' as const,
    title: t('home.pillars.billingTitle'),
    description: t('home.pillars.billingDesc')
  }
])

const ecosystemProviders = computed<
  Array<{
    id: EcosystemPlatformId
    label: string
    detail: string
  }>
>(() => [
  {
    id: 'anthropic',
    label: 'Claude',
    detail: t('home.ecosystem.items.anthropic')
  },
  {
    id: 'openai',
    label: 'OpenAI',
    detail: t('home.ecosystem.items.openai')
  },
  {
    id: 'gemini',
    label: 'Gemini',
    detail: t('home.ecosystem.items.gemini')
  },
  {
    id: 'antigravity',
    label: 'Antigravity',
    detail: t('home.ecosystem.items.antigravity')
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    detail: t('home.ecosystem.items.deepseek')
  },
  {
    id: 'grok',
    label: 'Grok',
    detail: t('home.ecosystem.items.grok')
  },
  {
    id: 'kimi',
    label: 'Kimi',
    detail: t('home.ecosystem.items.kimi')
  },
  {
    id: 'zhipu',
    label: 'Zhipu GLM',
    detail: t('home.ecosystem.items.zhipu')
  }
])

// Current year for footer
const currentYear = computed(() => new Date().getFullYear())

// Toggle theme
function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// Initialize theme
function initTheme() {
  const savedTheme = localStorage.getItem('theme')
  const shouldBeDark =
    savedTheme === 'dark' ||
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  isDark.value = shouldBeDark
  document.documentElement.classList.toggle('dark', shouldBeDark)
}

onMounted(() => {
  initTheme()

  // Check auth state
  authStore.checkAuth()

  // Ensure public settings are loaded (will use cache if already loaded from injected config)
  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }
})
</script>

<style scoped>
.home-masthead {
  background:
    radial-gradient(960px 380px at 50% -12%, rgba(45, 212, 191, 0.22), transparent 68%),
    linear-gradient(180deg, #0b4f4a 0%, #0d6860 56%, #0f766e 100%);
}

.home-theme-dark .home-masthead {
  background:
    radial-gradient(960px 380px at 50% -12%, rgba(20, 184, 166, 0.16), transparent 68%),
    linear-gradient(180deg, #062524 0%, #093532 58%, #0b413d 100%);
}

.home-compact-accent {
  background: linear-gradient(90deg, #0b4f4a 0%, #0f766e 50%, #0d9488 100%);
}

.home-theme-dark .home-compact-accent {
  background: linear-gradient(90deg, #093532 0%, #0f766e 50%, #14b8a6 100%);
}

.home-masthead ::selection {
  background-color: rgba(255, 255, 255, 0.26);
  color: #ffffff;
}

.home-masthead-cta {
  box-shadow:
    0 10px 24px -8px rgba(4, 47, 46, 0.42),
    0 2px 6px -1px rgba(4, 47, 46, 0.2);
}

.home-btn-teal {
  background: linear-gradient(180deg, #0f766e 0%, #0b5d56 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 6px 16px -8px rgba(11, 93, 86, 0.85);
}

.home-btn-teal:hover {
  background: linear-gradient(180deg, #0d6860 0%, #094f49 100%);
}

.home-pass-panel {
  box-shadow:
    0 20px 44px -16px rgba(15, 23, 42, 0.14),
    0 4px 12px -4px rgba(15, 23, 42, 0.06);
}

.home-theme-dark .home-pass-panel {
  box-shadow:
    0 24px 48px -16px rgba(0, 0, 0, 0.62),
    0 4px 14px -4px rgba(0, 0, 0, 0.4);
}

.home-pass-rail {
  border-top: 1px solid rgba(13, 148, 136, 0.55);
  border-bottom: 1px solid rgb(var(--edge-strong));
  background: rgba(20, 184, 166, 0.08);
}

.home-theme-dark .home-pass-rail {
  border-top-color: rgba(45, 212, 191, 0.52);
  border-bottom-color: rgb(var(--edge-strong));
  background: rgba(20, 184, 166, 0.12);
}

.home-pass-pill {
  transition:
    background-color 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    border-color 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    color 180ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

.home-pass-readout {
  animation: home-pass-enter 180ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

@keyframes home-pass-enter {
  from {
    opacity: 0.35;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-masthead-cta,
  .home-pass-pill {
    transition: none;
  }

  .home-pass-readout {
    animation: none;
  }
}
</style>
