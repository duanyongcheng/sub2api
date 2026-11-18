<template>
  <div class="relative" ref="dropdownRef">
    <button
      type="button"
      @click="toggleDropdown"
      :disabled="switching"
      :class="[
        'flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 sm:h-9 sm:px-2.5 sm:text-[13px]',
        props.variant === 'on-brand'
          ? 'text-[#e6fbf7] hover:bg-white/12 hover:text-white focus-visible:ring-white/70'
          : 'text-ink-2 hover:bg-surface-3 hover:text-ink focus-visible:ring-primary-500/40'
      ]"
      :title="currentLocale?.name"
      :aria-label="currentLocale?.name"
    >
      <Icon
        name="globe"
        size="sm"
        :class="props.variant === 'on-brand' ? 'text-[#e6fbf7]' : 'text-ink-2'"
      />
      <span>{{ currentLocale?.code.toUpperCase() }}</span>
      <Icon
        name="chevronDown"
        size="xs"
        class="transition-transform duration-200"
        :class="[
          props.variant === 'on-brand' ? 'text-teal-100/80' : 'text-ink-2',
          { 'rotate-180': isOpen }
        ]"
      />
    </button>

    <transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute right-0 z-50 mt-1.5 w-36 overflow-hidden rounded-field border border-edge bg-surface py-1 shadow-md"
      >
        <button
          v-for="locale in availableLocales"
          :key="locale.code"
          type="button"
          :disabled="switching"
          @click="selectLocale(locale.code)"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-2"
          :class="{
            'bg-primary-50 font-medium text-primary-700':
              locale.code === currentLocaleCode
          }"
        >
          <span class="w-5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-2">
            {{ locale.code }}
          </span>
          <span>{{ locale.name }}</span>
          <Icon v-if="locale.code === currentLocaleCode" name="check" size="sm" class="ml-auto text-primary-600" />
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { setLocale, availableLocales } from '@/i18n'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'on-brand'
  }>(),
  {
    variant: 'default'
  }
)

const { locale } = useI18n()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const switching = ref(false)

const currentLocaleCode = computed(() => locale.value)
const currentLocale = computed(() => availableLocales.find((l) => l.code === locale.value))

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

async function selectLocale(code: string) {
  if (switching.value || code === currentLocaleCode.value) {
    isOpen.value = false
    return
  }
  switching.value = true
  try {
    await setLocale(code)
    isOpen.value = false
    // 分组名称等内容由后端按请求语言返回，整页刷新让已加载的数据换成新语言
    window.location.reload()
  } finally {
    switching.value = false
  }
}

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: none;
  }
}
</style>
