<template>
  <div class="flex min-h-screen bg-surface">
    <!-- Brand rail (desktop only) -->
    <aside
      class="relative hidden w-[46%] max-w-[720px] flex-col overflow-hidden bg-slate-950 px-12 py-10 text-white lg:flex xl:px-16"
    >
      <!-- Decorative layers: radial glow + grid + terminal -->
      <div class="pointer-events-none absolute inset-0 auth-glow" aria-hidden="true"></div>
      <div class="pointer-events-none absolute inset-0 auth-grid" aria-hidden="true"></div>

      <router-link to="/" class="relative z-10 flex items-center gap-3">
        <span class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-primary shadow-primary-outline">
          <img v-if="settingsLoaded && siteLogo" :src="siteLogo" alt="" class="h-full w-full object-contain" />
          <span v-else class="text-[13px] font-extrabold tracking-[-0.04em] text-white">{{ logoInitials }}</span>
        </span>
        <span class="flex flex-col">
          <span class="text-[15px] font-bold leading-tight">{{ siteName }}</span>
          <span class="text-[11.5px] leading-tight text-white/50">{{ siteSubtitle }}</span>
        </span>
      </router-link>

      <!-- Spacer -->
      <div class="relative z-10 mt-auto flex flex-1 flex-col justify-center gap-8 py-10">
        <div class="terminal-card">
          <div class="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
            <span class="h-2 w-2 rounded-full bg-red-400/80"></span>
            <span class="h-2 w-2 rounded-full bg-amber-400/80"></span>
            <span class="h-2 w-2 rounded-full bg-emerald-400/80"></span>
            <span class="ml-2 font-mono text-[11px] text-white/45">terminal — {{ siteName.toLowerCase() }}</span>
          </div>
          <pre class="overflow-x-auto px-4 py-3.5 font-mono text-[12px] leading-[1.75] text-white/75"><span class="text-emerald-300/90">$</span> curl {{ curlEndpoint }}/v1/messages \
  -H <span class="text-teal-300/80">"x-api-key: sk-ant-***"</span> \
  -d <span class="text-teal-300/80">'{"model":"claude-opus-4.6","stream":true}'</span>
<span class="text-white/35"># routing → claude-pro-01 (US-West)…</span>
<span class="text-emerald-300">200 OK</span> · ttft 0.86s · $0.0042</pre>
        </div>

        <div>
          <p class="text-[26px] font-bold leading-[1.32] tracking-[-0.03em] xl:text-[30px]">
            {{ t('auth.brandHeadlineA', '把订阅额度，') }}<br />
            <span class="bg-gradient-to-r from-teal-300 to-sky-300 bg-clip-text text-transparent">
              {{ t('auth.brandHeadlineB', '变成一把可调度的钥匙') }}
            </span>
          </p>
          <p class="mt-3.5 max-w-md text-[13px] leading-relaxed text-white/55">
            {{ t('auth.brandSubline', '统一网关接入 Claude / OpenAI / Gemini / Grok，按分组定价、按额度结算，一个 Key 跑通全部 SDK。') }}
          </p>
        </div>
      </div>

      <div class="relative z-10 flex items-end justify-between gap-6">
        <div class="grid flex-1 grid-cols-3 gap-3">
          <div v-for="stat in brandStats" :key="stat.label" class="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <div class="text-[15px] font-bold tabular-nums leading-tight">{{ stat.value }}</div>
            <div class="mt-0.5 text-[11px] leading-tight text-white/45">{{ stat.label }}</div>
          </div>
        </div>
      </div>

      <div class="relative z-10 mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-white/35">
        <span>&copy; {{ currentYear }} {{ siteName }}</span>
        <slot name="brand-footer" />
      </div>
    </aside>

    <!-- Form column -->
    <main class="relative flex min-h-screen flex-1 flex-col bg-surface">
      <!-- Mobile brand -->
      <div class="flex items-center gap-2.5 px-6 pb-2 pt-7 lg:hidden">
        <span class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-primary">
          <img v-if="settingsLoaded && siteLogo" :src="siteLogo" alt="" class="h-full w-full object-contain" />
          <span v-else class="text-[12px] font-extrabold text-white">{{ logoInitials }}</span>
        </span>
        <span class="text-[14.5px] font-bold text-ink">{{ siteName }}</span>
      </div>

      <div class="flex flex-1 items-center justify-center px-6 py-10">
        <div class="w-full max-w-[400px]">
          <div class="auth-card">
            <slot />
          </div>

          <div v-if="$slots.footer" class="mt-6 text-center text-body text-ink-3">
            <slot name="footer" />
          </div>

          <div class="mt-6 text-center text-meta text-ink-3 lg:hidden">
            &copy; {{ currentYear }} {{ siteName }}
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import { sanitizeUrl } from '@/utils/url'

/**
 * AuthLayout — split layout: brand rail on the left, form on the right.
 *
 * Replaces the old "centred glass card on a gradient" shell. The left rail is
 * decorative and hidden below `lg`, where the form takes the full width.
 */
const { t } = useI18n()
const appStore = useAppStore()

const siteName = computed(() => appStore.siteName || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const siteSubtitle = computed(
  () => appStore.cachedPublicSettings?.site_subtitle || t('auth.brandSubtitle', 'AI API Gateway')
)
const settingsLoaded = computed(() => appStore.publicSettingsLoaded)
const currentYear = computed(() => new Date().getFullYear())

const logoInitials = computed(() => {
  const name = siteName.value.trim()
  if (!name) return 'S2'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
})

// The curl sample in the hero mirrors the site's API base so the snippet is
// never misleading about the host the visitor is about to use.
const curlEndpoint = computed(() => {
  const base = appStore.cachedPublicSettings?.api_base_url?.trim()
  if (!base) return 'https://api.example.com'
  return base.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '')
})

const brandStats = computed(() => [
  { label: t('auth.brandStat1', '统一接入平台'), value: '6+' },
  { label: t('auth.brandStat2', '兼容 SDK'), value: '3' },
  { label: t('auth.brandStat3', '平均首 Token'), value: '<900ms' }
])

onMounted(() => {
  void appStore.fetchPublicSettings()
})
</script>

<style scoped>
.auth-glow {
  background:
    radial-gradient(900px 420px at 10% -10%, rgba(20, 184, 166, 0.28), transparent 62%),
    radial-gradient(700px 380px at 95% 110%, rgba(56, 189, 248, 0.16), transparent 60%);
}

.auth-grid {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(120% 80% at 20% 20%, #000 30%, transparent 85%);
}

.terminal-card {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(2, 6, 23, 0.55);
  box-shadow: 0 24px 48px -24px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(6px);
}

.auth-card {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>
