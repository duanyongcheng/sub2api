<template>
  <section class="card">
    <div class="card-hd">
      <h3 class="text-sm font-semibold text-ink">{{ t('admin.dashboard.overview.todo') }}</h3>
      <span class="pill" :class="activeCount > 0 ? 'pill-warn' : 'pill-ok'">
        {{ t('admin.dashboard.overview.todoItems', { count: activeCount }) }}
      </span>
    </div>

    <div class="card-bd flex flex-col gap-2">
      <p v-if="activeTasks.length === 0" class="py-6 text-center text-body text-ink-3">
        {{ t('admin.dashboard.overview.todoNoData') }}
      </p>

      <button
        v-for="task in activeTasks"
        :key="task.key"
        type="button"
        class="task group"
        @click="navigate(task.to)"
      >
        <span class="task-icon" :style="{ background: task.bg, color: task.color }">
          <Icon :name="task.icon" size="sm" />
        </span>
        <span class="min-w-0 flex-1 text-left">
          <span class="block truncate text-[12.6px] font-semibold text-ink">{{ task.title }}</span>
          <span class="mt-0.5 block truncate text-[11.2px] text-ink-3">{{ task.hint }}</span>
        </span>
        <span class="shrink-0 text-[12px] font-bold tabular-nums" :style="{ color: task.color }">{{ task.count }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { TodoTask } from './TodoList.types'

/**
 * TodoList — "what needs a decision today", pinned to the top-right rail.
 *
 * The operations overview is reorganised around this list: KPIs answer "how
 * much", the to-do list answers "what do I do next". Items with a count of
 * zero are hidden, so a healthy system shows the empty state instead of five
 * zero rows.
 */
const props = defineProps<{ tasks: TodoTask[] }>()

const { t } = useI18n()
const router = useRouter()

const TONES: Record<TodoTask['tone'], { bg: string; color: string }> = {
  warn: { bg: 'rgb(245 158 11 / 0.14)', color: 'rgb(217 119 6)' },
  bad: { bg: 'rgb(239 68 68 / 0.12)', color: 'rgb(220 38 38)' },
  info: { bg: 'rgb(59 130 246 / 0.12)', color: 'rgb(37 99 235)' },
  neutral: { bg: 'rgb(var(--surface-3))', color: 'rgb(var(--ink-2))' }
}

const activeTasks = computed(() =>
  props.tasks
    .filter((task) => task.count > 0)
    .map((task) => ({ ...task, ...TONES[task.tone] }))
    .sort((a, b) => b.count - a.count)
)

const activeCount = computed(() => activeTasks.value.length)

function navigate(to: string) {
  if (to) void router.push(to)
}

// Exposed so the parent can build the strip items from the same source.
defineExpose({ activeTasks })
</script>

<style scoped>
.task {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border-radius: 10px;
  border: 1px solid rgb(var(--edge));
  background: rgb(var(--surface-2));
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.task:hover {
  border-color: rgba(45, 212, 191, 0.6);
  background: rgb(var(--surface));
}

.task-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 8px;
}
</style>
