<template>
  <div v-if="compact" class="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-ink-2">
    <button
      ref="triggerRef"
      type="button"
      data-testid="account-identity-disclosure-trigger"
      class="-ml-1 inline-flex min-h-4 min-w-0 max-w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 -my-0.5 text-left text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
      :aria-expanded="open"
      :aria-controls="panelId"
      :title="metadataTitle"
      :aria-label="metadataTitle"
      @click.stop="togglePopover"
    >
      <span class="truncate">{{ summaryLabel }}</span>
      <Icon
        name="chevronDown"
        size="xs"
        class="shrink-0 transition-transform duration-150 motion-reduce:transition-none"
        :class="{ 'rotate-180': open }"
        aria-hidden="true"
      />
    </button>
    <span
      v-if="privacyBadge"
      class="shrink-0 font-medium"
      :class="privacyMode?.includes('failed') ? 'text-bad-600' : privacyMode?.includes('blocked') ? 'text-warn-600' : 'text-ink-2'"
      :title="privacyBadge.title"
    >{{ privacyBadge.label }}</span>

    <Teleport to="body">
      <div
        v-if="open"
        :id="panelId"
        ref="panelRef"
        data-testid="account-identity-disclosure-panel"
        class="fixed z-[9999] w-max min-w-[11rem] max-w-[min(16.5rem,calc(100vw-1rem))] whitespace-normal break-words rounded-field border border-edge-strong bg-surface p-3 text-xs leading-5 text-ink shadow-xl"
        :style="panelStyle"
        @click.stop
      >
        <div class="flex flex-wrap items-center gap-1.5">
          <span :class="['inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium', typeClass]">
            <Icon v-if="typeIcon" :name="typeIcon" size="xs" />
            <span>{{ typeLabel }}</span>
          </span>
          <span
            v-if="planLabel"
            :class="['inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium', planBadgeClass]"
          >
            <GrokFreeIcon v-if="isGrokFreePlan" />
            <Icon v-else-if="planIconName" :name="planIconName" size="xs" aria-hidden="true" />
            <span>{{ planLabel }}</span>
          </span>
          <span v-if="tierLabel" :class="['inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', tierClass]">
            {{ tierLabel }}
          </span>
          <span
            v-if="privacyBadge"
            :class="['inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium', privacyBadge.class]"
          >
            <svg class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" :d="privacyBadge.icon" />
            </svg>
            <span>{{ privacyBadge.label }}</span>
          </span>
        </div>

        <div
          v-if="detailLines.length > 0"
          class="mt-2 space-y-1 border-t border-edge pt-2 text-[11.5px] leading-4 text-ink-2"
        >
          <p v-for="line in detailLines" :key="line.key" class="flex items-start gap-1.5">
            <span
              v-if="line.dotClass"
              :class="['mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', line.dotClass]"
              aria-hidden="true"
            />
            <span :class="line.className">{{ line.text }}</span>
          </p>
        </div>
      </div>
    </Teleport>
  </div>
  <div v-else class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-4">
    <!-- 类型：Key / OAuth / Token / AWS / Vertex（平台在独立列，这里不再重复） -->
    <span :class="['inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium', typeClass]" :title="typeTitle">
      <Icon v-if="typeIcon" :name="typeIcon" size="xs" />
      <span>{{ typeLabel }}</span>
    </span>

    <!-- 套餐档位 -->
    <span
      v-if="planLabel"
      :class="['inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium', planBadgeClass]"
      :title="planTitle"
    >
      <GrokFreeIcon v-if="isGrokFreePlan" data-testid="grok-free-plan-icon" />
      <Icon v-else-if="planIconName" :name="planIconName" size="xs" data-testid="grok-plan-icon" aria-hidden="true" />
      <span>{{ planLabel }}</span>
    </span>

    <!-- Antigravity 等级 -->
    <span v-if="tierLabel" :class="['inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', tierClass]">
      {{ tierLabel }}
    </span>

    <!-- 隐私模式（仅 OpenAI / Antigravity OAuth） -->
    <span
      v-if="privacyBadge"
      :class="['inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium', privacyBadge.class]"
      :title="privacyBadge.title"
    >
      <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" :d="privacyBadge.icon" />
      </svg>
      <span>{{ privacyBadge.label }}</span>
    </span>

    <!-- OpenAI 压缩模式：状态点 + 短标签 -->
    <span
      v-if="compactMeta"
      :class="['inline-flex shrink-0 items-center gap-1 font-medium', compactMeta.className]"
      :title="compactTitle"
    >
      <span :class="['h-1.5 w-1.5 rounded-full', compactMeta.dotClass]" />
      <span>{{ compactMeta.label }}</span>
    </span>

    <!-- 订阅到期日 -->
    <span v-if="expiresLabel" class="shrink-0 text-[10.5px] text-gray-400 dark:text-gray-500" :title="subscriptionExpiresAt">
      {{ expiresLabel }}
    </span>
  </div>
</template>

<script lang="ts">
let activeIdentityPopoverClose: (() => void) | null = null
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { AccountPlatform, AccountType } from '@/types'
import { normalizePlanType, openAIPlanTypeLabel } from '@/utils/planType'
import GrokFreeIcon from '@/components/common/GrokFreeIcon.vue'
import Icon from '@/components/icons/Icon.vue'

const props = defineProps<{
  row: { platform: AccountPlatform; type: AccountType }
  authMode?: string
  planType?: string
  privacyMode?: string
  subscriptionExpiresAt?: string
  tierLabel?: string | null
  tierClass?: string
  /** 来自 AccountsView#getOpenAICompactMeta 的 { label, className, dotClass } */
  compactMeta?: { label: string; className: string; dotClass: string } | null
  compactTitle?: string
  /** Keep table metadata to one line; disclose all values on demand. */
  compact?: boolean
}>()

const { t } = useI18n()

const platform = computed(() => props.row.platform)
const type = computed(() => props.row.type)

const normalizedAuthMode = computed(() =>
  (props.authMode || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
)

const typeLabel = computed(() => {
  if (platform.value === 'openai' && type.value === 'oauth') {
    if (normalizedAuthMode.value === 'agentidentity') return 'Agent Identity'
    if (normalizedAuthMode.value === 'personalaccesstoken') return 'PAT'
  }
  switch (type.value) {
    case 'oauth':
      return 'OAuth'
    case 'setup-token':
      return 'Token'
    case 'apikey':
      return 'Key'
    case 'bedrock':
      return 'AWS'
    case 'service_account':
      return 'Vertex'
    default:
      return type.value
  }
})

// service_account 的完整名称放 title，行内只放 Vertex，保证身份行不会被撑宽。
const typeTitle = computed(() =>
  type.value === 'service_account' ? 'Agent Platform (Vertex)' : typeLabel.value
)

const typeIcon = computed(() => {
  switch (type.value) {
    case 'oauth':
      return 'key'
    case 'setup-token':
      return 'shield'
    default:
      return 'key'
  }
})

// 类型配色只区分凭证类型，与平台色无关（平台名本身已经是彩色文字）。
const typeClass = computed(() => {
  switch (type.value) {
    case 'oauth':
      return 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
    case 'setup-token':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'service_account':
      return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
    case 'bedrock':
      return 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
    default:
      return 'bg-gray-500/10 text-gray-600 dark:text-gray-300'
  }
})

const normalizedPlanType = computed(() => normalizePlanType(props.planType))

const planLabel = computed(() => {
  if (!normalizedPlanType.value) return ''
  // ChatGPT 档位命名（Pro 100 / Pro 200 / Pro 500、Business / Business Premium）只适用于
  // OpenAI：Antigravity 与 Grok 各自的 pro/team 沿用下面的通用标签。
  if (platform.value === 'openai') {
    const label = openAIPlanTypeLabel(props.planType)
    if (label) return label
  }
  switch (normalizedPlanType.value) {
    case 'plus':
      return 'Plus'
    case 'team':
      return 'Team'
    case 'chatgptpro':
    case 'pro':
      return 'Pro'
    case 'free':
    case 'basic':
      return platform.value === 'grok' ? 'Grok Free' : 'Free'
    case 'supergrok':
      return 'SuperGrok'
    case 'supergroklite':
      return 'SuperGrok Lite'
    case 'supergrokplus':
      return 'SuperGrok Plus'
    case 'supergrokheavy':
      return 'SuperGrok Heavy'
    case 'heavy':
      return 'Heavy'
    case 'xbasic':
      return 'X Basic'
    case 'abnormal':
      return t('admin.accounts.subscriptionAbnormal')
    default:
      return props.planType
  }
})

const hasDistinctRawPlan = computed(() => {
  const raw = (props.planType ?? '').trim()
  return Boolean(raw && planLabel.value && raw.toLowerCase() !== planLabel.value.trim().toLowerCase())
})

const planTitle = computed(() => {
  if (!planLabel.value) return ''
  return hasDistinctRawPlan.value ? `${planLabel.value} · ${props.planType!.trim()}` : planLabel.value
})

const isGrokFreePlan = computed(() =>
  platform.value === 'grok' &&
  (normalizedPlanType.value === 'free' ||
    normalizedPlanType.value === 'basic' ||
    normalizedPlanType.value === 'xbasic')
)

const planIconName = computed<'bolt' | null>(() => {
  if (platform.value !== 'grok') return null
  // Paid Grok tiers (SuperGrok / Heavy) share the bolt mark; free uses GrokFreeIcon.
  if (
    normalizedPlanType.value === 'supergrok' ||
    normalizedPlanType.value === 'supergrokheavy' ||
    normalizedPlanType.value === 'heavy' ||
    normalizedPlanType.value.includes('heavy')
  ) {
    return 'bolt'
  }
  return null
})

const planBadgeClass = computed(() => {
  if (normalizedPlanType.value === 'abnormal') {
    return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
  }
  // Free stays muted gray; paid Grok tiers get distinct colors.
  if (
    normalizedPlanType.value === 'free' ||
    normalizedPlanType.value === 'basic' ||
    normalizedPlanType.value === 'xbasic'
  ) {
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
  if (platform.value === 'grok' && normalizedPlanType.value) {
    if (normalizedPlanType.value.includes('heavy')) {
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
    }
    if (normalizedPlanType.value.includes('supergrok')) {
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
    }
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  }
  if (normalizedPlanType.value === 'plus') {
    return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
  }
  if (normalizedPlanType.value === 'team' || normalizedPlanType.value === 'selfservebusinessprolite' ||
    (platform.value === 'openai' && ['selfservebusinessusagebased', 'business', 'enterprise', 'ent26', 'enterprisecbpautomation', 'enterprisecbpusagebased', 'edu', 'eduplus', 'edupro'].includes(normalizedPlanType.value))) {
    return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
  }
  if (
    normalizedPlanType.value === 'pro' ||
    normalizedPlanType.value === 'chatgptpro' ||
    normalizedPlanType.value === 'prolite' ||
    (platform.value === 'openai' && normalizedPlanType.value === 'promax')
  ) {
    return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
  }
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
})

// Subscription expiration label (non-free only)
const expiresLabel = computed(() => {
  if (!props.subscriptionExpiresAt || !props.planType) return ''
  if (
    normalizedPlanType.value === 'free' ||
    normalizedPlanType.value === 'basic' ||
    normalizedPlanType.value === 'xbasic'
  ) return ''
  try {
    const d = new Date(props.subscriptionExpiresAt)
    if (isNaN(d.getTime())) return ''
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${t('admin.accounts.subscriptionExpires')} ${yyyy}-${mm}-${dd}`
  } catch {
    return ''
  }
})

// Privacy badge — OpenAI / Antigravity OAuth only.
const privacyBadge = computed(() => {
  if (type.value !== 'oauth' || !props.privacyMode) return null
  if (platform.value !== 'openai' && platform.value !== 'antigravity') return null

  const shieldCheck = 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z'
  const shieldX = 'M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 18h.008v.008H12V18z'
  switch (props.privacyMode) {
    case 'training_off':
      return { label: 'Private', icon: shieldCheck, title: t('admin.accounts.privacyTrainingOff'), class: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' }
    case 'training_set_cf_blocked':
      return { label: 'CF', icon: shieldX, title: t('admin.accounts.privacyCfBlocked'), class: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' }
    case 'training_set_failed':
      return { label: 'Fail', icon: shieldX, title: t('admin.accounts.privacyFailed'), class: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' }
    case 'privacy_set':
      return { label: 'Private', icon: shieldCheck, title: t('admin.accounts.privacyAntigravitySet'), class: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' }
    case 'privacy_set_failed':
      return { label: 'Fail', icon: shieldX, title: t('admin.accounts.privacyAntigravityFailed'), class: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' }
    default:
      return null
  }
})
const summaryLabel = computed(() =>
  [typeLabel.value, planLabel.value, props.tierLabel].filter(Boolean).join(' · ')
)

interface DetailLine {
  key: string
  text: string
  dotClass?: string
  className?: string
}

const detailLines = computed<DetailLine[]>(() => {
  const lines: DetailLine[] = []
  if (typeTitle.value && typeTitle.value !== typeLabel.value) {
    lines.push({ key: 'type', text: typeTitle.value })
  }
  if (hasDistinctRawPlan.value && planTitle.value) {
    lines.push({ key: 'plan', text: planTitle.value })
  }
  if (privacyBadge.value?.title) {
    lines.push({ key: 'privacy', text: privacyBadge.value.title })
  }
  const compactText = props.compactTitle || props.compactMeta?.label
  if (compactText) {
    lines.push({
      key: 'compact',
      text: compactText,
      dotClass: props.compactMeta?.dotClass,
      className: props.compactMeta?.className
    })
  }
  if (expiresLabel.value) {
    lines.push({ key: 'expires', text: expiresLabel.value })
  }
  return lines
})

const metadata = computed(() => [
  typeTitle.value,
  planTitle.value,
  props.tierLabel,
  privacyBadge.value?.title,
  props.compactTitle || props.compactMeta?.label,
  expiresLabel.value
].filter((item): item is string => Boolean(item)))
const metadataTitle = computed(() => metadata.value.join(' · '))

const instanceId = useId()
const panelId = `account-identity-panel-${instanceId}`
const open = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const VIEWPORT_PADDING = 8
const PANEL_GAP = 6
const FALLBACK_PANEL_WIDTH = 224
const panelPosition = ref({ top: VIEWPORT_PADDING, left: VIEWPORT_PADDING })
const panelStyle = computed(() => ({
  top: `${panelPosition.value.top}px`,
  left: `${panelPosition.value.left}px`
}))

function updatePosition() {
  const triggerEl = triggerRef.value
  if (!triggerEl || typeof window === 'undefined') return

  const triggerRect = triggerEl.getBoundingClientRect()
  const vw = document.documentElement.clientWidth || window.innerWidth
  const vh = window.innerHeight
  const panelRect = panelRef.value?.getBoundingClientRect()
  const panelWidth = panelRect?.width || Math.min(FALLBACK_PANEL_WIDTH, Math.max(0, vw - VIEWPORT_PADDING * 2))
  const panelHeight = panelRect?.height || 0

  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(triggerRect.left, Math.max(VIEWPORT_PADDING, vw - panelWidth - VIEWPORT_PADDING))
  )

  let top = triggerRect.bottom + PANEL_GAP
  if (panelHeight > 0 && top + panelHeight > vh - VIEWPORT_PADDING) {
    const candidateAbove = triggerRect.top - panelHeight - PANEL_GAP
    if (candidateAbove >= VIEWPORT_PADDING || triggerRect.top > vh - triggerRect.bottom) {
      top = Math.max(VIEWPORT_PADDING, candidateAbove)
    } else {
      top = Math.max(VIEWPORT_PADDING, vh - panelHeight - VIEWPORT_PADDING)
    }
  }

  panelPosition.value = { top, left }
}

function closePopover() {
  open.value = false
  if (activeIdentityPopoverClose === closePopover) {
    activeIdentityPopoverClose = null
  }
}

function togglePopover() {
  if (open.value) {
    closePopover()
    return
  }
  if (activeIdentityPopoverClose && activeIdentityPopoverClose !== closePopover) {
    activeIdentityPopoverClose()
  }
  activeIdentityPopoverClose = closePopover
  updatePosition()
  open.value = true
  void nextTick(updatePosition)
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (triggerRef.value?.contains(target) || panelRef.value?.contains(target)) return
  closePopover()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closePopover()
    triggerRef.value?.focus({ preventScroll: true })
  } else if (event.key === 'Tab') {
    closePopover()
  }
}

function onWindowScroll(event: Event) {
  if (!open.value) return
  if (event.target instanceof Node && panelRef.value?.contains(event.target)) return
  closePopover()
}

function onWindowResize() {
  if (open.value) updatePosition()
}

function attachGlobalListeners() {
  if (typeof window === 'undefined') return
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('scroll', onWindowScroll, true)
  window.addEventListener('resize', onWindowResize)
}

function detachGlobalListeners() {
  if (typeof window === 'undefined') return
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('scroll', onWindowScroll, true)
  window.removeEventListener('resize', onWindowResize)
}

watch(open, (isOpen) => {
  if (isOpen) {
    attachGlobalListeners()
    void nextTick(updatePosition)
  } else {
    detachGlobalListeners()
  }
})

watch(
  () => props.compact,
  (isCompact) => {
    if (!isCompact && open.value) closePopover()
  }
)

useResizeObserver(panelRef, () => {
  if (open.value) updatePosition()
})

onBeforeUnmount(() => {
  detachGlobalListeners()
  if (activeIdentityPopoverClose === closePopover) {
    activeIdentityPopoverClose = null
  }
})
</script>
