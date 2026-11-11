<template>
  <!--
    账号表「用量」列的次要操作折叠条。

    窗口条（5h / 7d）和统计行是每行都要扫一眼的主信息，始终展示；而辅助操作
    （查询、次数 / 重置、点数、邀请、可邀请次数）是低频操作，逐行铺开会把整列
    撑成两行小按钮。这里把它们收进一个图标按钮：

    - 收起：窗口条首行右端只有一个小小的「⋯」图标按钮（无边框、无文字）；
    - 展开：图标换成「×」，操作面板在窗口条下方铺开（跨整列），点「×」收起；
    - 面板不占窗口条右侧空间，窗口条的宽度与对齐保持稳定；
    - 行与行之间的展开状态彼此独立，页面不新增全局开关。

    根节点使用 display: contents，让图标与面板分别成为父级网格的 item，
    由父级（AccountUsageCell）决定两者各自落在哪一行。
  -->
  <div class="account-usage-actions" :class="{ 'is-open': props.open }" data-testid="account-usage-actions">
    <button
      type="button"
      class="account-usage-actions__toggle"
      data-testid="account-usage-actions-toggle"
      :aria-expanded="props.open"
      :aria-label="props.open ? t('admin.accounts.usageActions.collapse') : t('admin.accounts.usageActions.moreAria')"
      :title="toggleTitle"
      @click.stop="toggleOpen"
    >
      <span class="account-usage-actions__glyph account-usage-actions__glyph--collapsed" aria-hidden="true">
        <Icon name="more" size="xs" class="account-usage-actions__icon" />
      </span>
      <span class="account-usage-actions__glyph account-usage-actions__glyph--expanded" aria-hidden="true">
        <Icon name="x" size="xs" class="account-usage-actions__icon is-open" />
      </span>
    </button>

    <Transition name="account-usage-actions-fade">
      <div
        v-show="props.open"
        class="account-usage-actions__panel rounded-lg border border-gray-200/90 bg-gray-50/80 p-1.5 shadow-sm dark:border-dark-700 dark:bg-dark-800/60"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'

const props = withDefaults(
  defineProps<{
    /**
     * 数值摘要（如 Codex 点数余额、可邀请次数）。图标按钮本身不展示文字，
     * 摘要只出现在 tooltip 里，保证每个账号行的宽度一致。
     */
    badge?: string | number | null
    badgeTitle?: string
    open?: boolean
  }>(),
  { badge: null, badgeTitle: '', open: false }
)

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t } = useI18n()

// 收起时提示「展开」，展开时把最近一次查询到的数值也放进 tooltip（摘要已隐藏）。
const toggleTitle = computed(() => {
  if (!props.open) return t('admin.accounts.usageActions.expand')
  return props.badge
    ? `${t('admin.accounts.usageActions.collapse')} · ${props.badgeTitle || props.badge}`
    : t('admin.accounts.usageActions.collapse')
})

const toggleOpen = () => {
  emit('update:open', !props.open)
}
</script>

<style scoped>
/* 根节点透明：图标与面板分别参与父级网格定位。 */
.account-usage-actions {
  display: contents;
}

/* 图标按钮：16×16，与窗口条首行对齐；默认低对比，hover / 键盘聚焦才加深。 */
.account-usage-actions__toggle {
  display: inline-flex;
  position: relative;
  align-items: center;
  justify-content: center;
  height: 16px;
  width: 16px;
  border-radius: 4px;
  padding: 0;
  color: #9ca3af;
  transition: background-color 120ms ease, color 120ms ease;
}

.account-usage-actions__toggle:hover {
  background-color: rgba(0, 0, 0, 0.04);
  color: #4b5563;
}

/* 16px 的视觉图标，24px 的点击热区；不改变表格列宽。 */
.account-usage-actions__toggle::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 6px;
}

.account-usage-actions__toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgb(var(--primary-500) / 0.35);
  color: #4b5563;
}

:global(.dark) .account-usage-actions__toggle {
  color: #6b7280;
}

:global(.dark) .account-usage-actions__toggle:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #d1d5db;
}

.account-usage-actions__icon {
  stroke-width: 2;
}

/* 两个图标叠在同一个 16×16 的格子里，切换时行高 / 宽度不变。 */
.account-usage-actions__glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.account-usage-actions__glyph--expanded {
  position: absolute;
  inset: 0;
  opacity: 0;
}

.account-usage-actions.is-open .account-usage-actions__glyph--collapsed {
  opacity: 0;
}

.account-usage-actions.is-open .account-usage-actions__glyph--expanded {
  opacity: 1;
}

/* 展开时是「×」，稍深一点表示当前可点收起。 */
.account-usage-actions__icon.is-open {
  color: #6b7280;
}

/* 面板：父级网格负责跨列与换行，这里只管内部留白与过渡。 */
.account-usage-actions__panel {
  min-width: 0;
}

.account-usage-actions-fade-enter-active,
.account-usage-actions-fade-leave-active {
  transition: opacity 120ms ease;
}

.account-usage-actions-fade-enter-from,
.account-usage-actions-fade-leave-to {
  opacity: 0;
}
</style>
