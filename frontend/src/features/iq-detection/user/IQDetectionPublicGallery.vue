<template>
  <section
    class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs"
    data-testid="iq-public-gallery"
    aria-labelledby="iq-public-gallery-title"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-edge bg-surface-2 px-4 py-3 sm:px-5"
    >
      <div class="min-w-0">
        <h2 id="iq-public-gallery-title" class="text-[14px] font-semibold text-ink">
          {{ t('iqDetection.public.gallery.title') }}
        </h2>
        <p class="mt-0.5 text-xs text-ink-2">
          {{ t('iqDetection.public.gallery.subtitle') }}
        </p>
      </div>
      <span class="chip shrink-0 !font-medium">
        <Icon name="shield" size="xs" class="text-primary-600 dark:text-primary-400" />
        {{ t('iqDetection.public.gallery.sandboxNotice') }}
      </span>
    </div>

    <p
      v-if="items.length === 0"
      class="px-4 py-8 text-center text-xs text-ink-3 sm:px-5"
      data-testid="iq-public-gallery-empty"
    >
      {{ t('iqDetection.public.gallery.empty') }}
    </p>

    <div v-else class="grid grid-cols-1" :class="gridClass">
      <figure
        v-for="item in items"
        :key="item.run.id"
        class="m-0 flex min-w-0 flex-col border-edge bg-surface"
        :data-testid="`iq-public-art-${item.run.group_id}`"
      >
        <div class="relative aspect-[16/10] w-full overflow-hidden bg-surface-3">
          <IQDetectionPelicanStage
            v-if="item.html"
            :html="item.html"
            :title="t('iqDetection.public.gallery.frameTitle', { group: item.run.group_name })"
            :replay-key="`${item.run.id}-${replayCounter[item.run.id] ?? 0}`"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center px-4 text-center text-xs text-ink-3"
          >
            {{ t('iqDetection.public.gallery.noArtifact') }}
          </div>
        </div>

        <figcaption class="flex items-center justify-between gap-3 border-t border-edge px-4 py-2.5">
          <div class="min-w-0">
            <div class="truncate text-[13px] font-semibold text-ink" :title="item.run.group_name">
              {{ item.run.group_name }}
            </div>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] tabular-nums text-ink-3">
              <span :title="formatDateTime(runTimestamp(item.run))">
                {{ formatRelativeTime(runTimestamp(item.run)) }}
              </span>
              <span
                v-if="item.offlineViolation"
                class="font-medium text-amber-700 dark:text-amber-300"
              >
                · {{ t('iqDetection.public.gallery.externalChip') }}
              </span>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span
              v-if="item.score != null"
              class="text-[12.5px] font-semibold tabular-nums"
              :class="scoreTextClasses(item.score)"
            >
              {{ t('iqDetection.public.result.score', { score: Math.round(item.score) }) }}
            </span>
            <button
              v-if="item.html"
              type="button"
              class="btn btn-ghost btn-sm !h-7 !px-2 text-[11.5px]"
              :aria-label="t('iqDetection.public.gallery.replayAria', { group: item.run.group_name })"
              data-testid="iq-public-art-replay"
              @click="replay(item.run.id)"
            >
              <Icon name="refresh" size="xs" />
              {{ t('iqDetection.public.gallery.replay') }}
            </button>
          </div>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { formatRelativeTime } from '@/utils/format'
import IQDetectionPelicanStage from '../IQDetectionPelicanStage.vue'
import { formatDateTime, scoreTextClasses } from '../verdictMeta'
import type { IQDetectionPublicRun } from './publicTypes'
import { pickPublicArtifactHtml, resolvePublicRunScore, runTimestamp } from './publicMeta'

const props = defineProps<{
  runs: IQDetectionPublicRun[]
}>()

const { t } = useI18n()
const replayCounter = reactive<Record<number, number>>({})

const items = computed(() =>
  props.runs.map((run) => ({
    run,
    html: pickPublicArtifactHtml(run),
    score: resolvePublicRunScore(run),
    offlineViolation: (run.artifacts ?? []).some((a) => a && a.offline_compliant === false)
  }))
)

// Hairline grid without filler cells: each figure draws its own dividers.
const gridClass = computed(() => {
  const n = items.value.length
  if (n <= 1) return '[&>figure]:mx-auto [&>figure]:w-full [&>figure]:max-w-[720px]'
  if (n === 2) {
    return 'md:grid-cols-2 [&>figure]:border-b md:[&>figure]:border-b-0 [&>figure:last-child]:border-b-0 md:[&>figure:first-child]:border-r'
  }
  return 'md:grid-cols-2 xl:grid-cols-3 [&>figure]:border-b [&>figure:last-child]:border-b-0 [&>figure]:md:border-r md:[&>figure:nth-child(2n)]:border-r-0 xl:[&>figure:nth-child(2n)]:border-r xl:[&>figure:nth-child(3n)]:border-r-0'
})

/** Local-only: re-mounts the sandbox so the artwork's animation starts over. */
function replay(runId: number) {
  replayCounter[runId] = (replayCounter[runId] ?? 0) + 1
}
</script>
