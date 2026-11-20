<template>
  <AppLayout>
    <div class="flex w-full min-w-0 flex-col gap-4 pb-8">
      <!-- Mobile-only heading (AppHeader renders route title & description from lg upward) -->
      <div class="lg:hidden">
        <h1 class="text-[19px] font-bold leading-[26px] tracking-[-0.025em] text-ink">
          {{ t('iqDetection.title') }}
        </h1>
        <p class="mt-0.5 text-xs text-ink-2">
          {{ t('iqDetection.description') }}
        </p>
      </div>

      <!-- Unified Slim Top Control Bar: Navigation + Saved Runtime Pills + Manual Probe Controls -->
      <div
        class="flex flex-wrap items-center justify-between gap-2.5"
      >
        <div class="flex flex-wrap items-center gap-2">
          <!-- Segmented View Switcher -->
          <div
            class="seg"
            role="tablist"
            :aria-label="t('iqDetection.tabs.aria')"
          >
            <button
              type="button"
              role="tab"
              data-testid="iq-tab-overview"
              :class="{ on: activeTab === 'overview' }"
              :aria-selected="activeTab === 'overview'"
              @click="setTab('overview')"
            >
              {{ t('iqDetection.tabs.overview') }}
            </button>
            <button
              type="button"
              role="tab"
              data-testid="iq-tab-settings"
              :class="{ on: activeTab === 'settings' }"
              :aria-selected="activeTab === 'settings'"
              @click="setTab('settings')"
            >
              {{ t('iqDetection.tabs.settings') }}
            </button>
          </div>

          <!-- Saved Patrol & Default Benchmark Telemetry Pills -->
          <template v-if="overview?.config">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-2"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="overview.config.enabled ? 'bg-emerald-500' : 'bg-ink-3'"
                aria-hidden="true"
              />
              {{
                overview.config.enabled
                  ? formatPatrolEnabledBadge(overview.config)
                  : t('iqDetection.overview.patrolDisabledBadge')
              }}
            </span>

            <span
              v-for="bench in enabledBenchmarks"
              :key="bench"
              class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="benchmarkBadgeClasses(bench)"
            >
              <span>{{ t(`iqDetection.benchmark.${bench}`) }}</span>
              <span class="font-mono text-[11px] font-medium tabular-nums opacity-80">
                ·
                {{
                  t('iqDetection.overview.testsPerGroupShort', {
                    n: bench === 'pelican_svg' ? 1 : overview.config.tests_per_group || 1
                  })
                }}
              </span>
            </span>

            <span
              class="items-center rounded-full border border-edge bg-surface px-2.5 py-0.5 font-mono text-xs tabular-nums text-ink-2"
              :class="activeTab === 'settings' ? 'hidden lg:inline-flex' : 'hidden 2xl:inline-flex'"
            >
              {{ overview.config.model }} · {{ overview.config.reasoning_effort }}
            </span>
          </template>
        </div>

        <!-- Right: Inline Manual Benchmark Override + Refresh + Primary Probe CTA (Overview only) -->
        <div v-if="activeTab === 'overview'" class="flex flex-wrap items-center gap-2">
          <Select
            :model-value="manualRunBenchmark"
            :options="manualRunBenchmarkOptions"
            :disabled="runningAll"
            :searchable="false"
            size="sm"
            align="right"
            data-testid="iq-run-benchmark-select"
            :aria-label="t('iqDetection.benchmark.quickRunAria')"
            class="iq-toolbar-select w-[164px] shrink-0"
            @update:model-value="onManualRunBenchmarkChange"
          >
            <template #selected="{ option }">
              <span class="inline-flex min-w-0 items-center gap-1.5 font-semibold text-ink">
                <Icon
                  :name="manualRunOptionIcon(option?.value)"
                  size="xs"
                  class="shrink-0"
                  :class="option?.value === 'candy_logic' ? 'text-ink-2' : 'text-primary-600 dark:text-primary-400'"
                />
                <span class="truncate">{{ option?.label }}</span>
              </span>
            </template>
            <template #option="{ option, selected }">
              <span class="flex min-w-0 flex-1 items-center gap-2">
                <span
                  class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                  :class="
                    selected || option.value !== 'candy_logic'
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400'
                      : 'bg-surface-3 text-ink-2'
                  "
                >
                  <Icon :name="manualRunOptionIcon(option.value)" size="xs" />
                </span>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-xs font-semibold leading-tight">{{ option.label }}</span>
                  <span class="mt-0.5 truncate font-mono text-[10.5px] leading-tight text-ink-3">
                    {{ option.meta }}
                  </span>
                </span>
              </span>
              <Icon
                v-if="selected"
                name="check"
                size="xs"
                class="shrink-0 text-primary-600 dark:text-primary-400"
                :stroke-width="2.2"
              />
            </template>
          </Select>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-testid="iq-refresh-btn"
            :disabled="loadingOverview || loadingHistory"
            @click="reloadAll"
          >
            <Icon name="refresh" size="sm" :class="loadingOverview ? 'animate-spin' : ''" />
            {{ t('iqDetection.actions.refresh') }}
          </button>

          <button
            type="button"
            class="btn btn-primary btn-sm"
            data-testid="iq-run-all-btn"
            :disabled="runningAll"
            @click="handleRunAll()"
          >
            <Icon name="play" size="sm" />
            {{
              runningAll
                ? t('iqDetection.actions.runningAll')
                : t('iqDetection.actions.runAll')
            }}
          </button>
        </div>
      </div>

      <!-- Settings Tab -->
      <IQDetectionSettingsPanel
        v-if="activeTab === 'settings'"
        :initial-config="overview?.config ?? null"
        :running="runningAll"
        @saved="handleConfigSaved"
        @saved-and-run="handleConfigSavedAndRun"
      />

      <!-- Overview Tab -->
      <template v-else>
        <!-- Band 1: Unified Hairline Summary Strip + Attached Benchmark Mismatch Triage Bar -->
        <section
          class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs"
          data-testid="iq-summary-cards"
        >
          <div
            class="grid grid-cols-2 divide-y divide-edge sm:grid-cols-3 lg:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,1fr))] lg:divide-x lg:divide-y-0"
          >
            <!-- Lead Cell: Configured Group Readiness + 4-state proportional bar -->
            <div class="col-span-2 flex flex-col justify-center px-4 py-3 sm:col-span-3 lg:col-span-1">
              <div class="flex items-center justify-between gap-2 text-[11.5px] font-semibold text-ink-2">
                <span>{{ t('iqDetection.summary.configured') }}</span>
                <span class="font-mono text-[11px] font-normal tabular-nums text-ink-3">
                  {{
                    t('iqDetection.summary.testedSub', {
                      tested: overview?.summary.tested_count ?? 0,
                      total: overview?.summary.configured_count ?? 0
                    })
                  }}
                </span>
              </div>
              <div class="mt-1 flex items-baseline gap-2 tabular-nums">
                <span class="font-mono text-[22px] font-bold leading-tight tracking-[-0.025em] text-ink">
                  {{ overview?.summary.configured_count ?? 0 }}
                </span>
                <span
                  v-if="(overview?.summary.configured_count ?? 0) > 0"
                  class="text-xs font-semibold"
                  :class="
                    (overview?.summary.degraded_count ?? 0) > 0
                      ? 'text-rose-700 dark:text-rose-300'
                      : (overview?.summary.warning_count ?? 0) > 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                  "
                >
                  {{ readinessRatioLabel }}
                </span>
              </div>
              <div
                class="mt-2 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-3"
                aria-hidden="true"
              >
                <span
                  v-if="summarySegments.normal > 0"
                  class="h-full bg-primary-500 transition-[width] duration-150 motion-reduce:transition-none"
                  :style="{ width: `${summarySegments.normal}%` }"
                />
                <span
                  v-if="summarySegments.warning > 0"
                  class="h-full bg-amber-500 transition-[width] duration-150 motion-reduce:transition-none"
                  :style="{ width: `${summarySegments.warning}%` }"
                />
                <span
                  v-if="summarySegments.degraded > 0"
                  class="h-full bg-rose-500 transition-[width] duration-150 motion-reduce:transition-none"
                  :style="{ width: `${summarySegments.degraded}%` }"
                />
                <span
                  v-if="summarySegments.other > 0"
                  class="h-full bg-ink-3/40 transition-[width] duration-150 motion-reduce:transition-none"
                  :style="{ width: `${summarySegments.other}%` }"
                />
              </div>
            </div>

            <!-- Normal -->
            <div class="flex flex-col justify-center border-r border-edge px-4 py-3 lg:border-r-0">
              <div class="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {{ t('iqDetection.summary.normal') }}
              </div>
              <div class="mt-1 font-mono text-[22px] font-bold leading-tight tabular-nums text-emerald-700 dark:text-emerald-300">
                {{ overview?.summary.normal_count ?? 0 }}
              </div>
            </div>

            <!-- Warning -->
            <div class="flex flex-col justify-center px-4 py-3 sm:border-r sm:border-edge lg:border-r-0">
              <div class="flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">
                <span class="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {{ t('iqDetection.summary.warning') }}
              </div>
              <div class="mt-1 font-mono text-[22px] font-bold leading-tight tabular-nums text-amber-700 dark:text-amber-300">
                {{ overview?.summary.warning_count ?? 0 }}
              </div>
            </div>

            <!-- Degraded -->
            <div class="flex flex-col justify-center border-r border-edge px-4 py-3 lg:border-r-0">
              <div class="flex items-center gap-1.5 text-[11.5px] font-semibold text-rose-700 dark:text-rose-300">
                <span class="h-1.5 w-1.5 rounded-full bg-rose-500" />
                {{ t('iqDetection.summary.degraded') }}
              </div>
              <div class="mt-1 font-mono text-[22px] font-bold leading-tight tabular-nums text-rose-700 dark:text-rose-300">
                {{ overview?.summary.degraded_count ?? 0 }}
              </div>
            </div>

            <!-- Error / Untested -->
            <div class="flex flex-col justify-center px-4 py-3">
              <div class="text-[11.5px] font-semibold text-ink-2">
                {{ t('iqDetection.summary.errorOrUntested') }}
              </div>
              <div class="mt-1 font-mono text-[22px] font-bold leading-tight tabular-nums text-ink">
                {{ (overview?.summary.error_count ?? 0) + (overview?.summary.untested_count ?? 0) }}
              </div>
            </div>
          </div>

          <!-- Attached Benchmark Sync Triage Bar when latest runs don't cover enabled benchmarks -->
          <div
            v-if="mismatchSummary"
            class="flex flex-col items-start gap-2.5 border-t border-edge bg-amber-500/5 px-4 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
            data-testid="iq-benchmark-mismatch-bar"
          >
            <div class="min-w-0 flex-1 space-y-0.5 text-amber-800 dark:text-amber-200">
              <div class="flex items-start gap-1.5 font-medium sm:items-center">
                <Icon name="exclamationTriangle" size="sm" class="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400 sm:mt-0" />
                <span>
                  {{
                    t('iqDetection.summary.mismatchNotice', {
                      target: mismatchSummary.targetLabel,
                      count: mismatchSummary.groups.length
                    })
                  }}
                </span>
              </div>
              <p v-if="mismatchSummary.hasScheduledConflict" class="pl-5 text-[11.5px] text-ink-2">
                {{ t('iqDetection.summary.scheduledConflictHint') }}
              </p>
            </div>

            <button
              type="button"
              class="btn btn-primary btn-sm w-full shrink-0 sm:w-auto"
              data-testid="iq-sync-benchmark-run-btn"
              :disabled="runningAll"
              @click="handleRunMismatchSync"
            >
              <Icon name="play" size="xs" />
              {{
                t('iqDetection.actions.runWithBenchmark', {
                  benchmark: mismatchSummary.targetLabel
                })
              }}
            </button>
          </div>
        </section>

        <!-- Band 2: Configured Groups Real-Time Status -->
        <section class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-edge bg-surface-2 px-4 py-3 sm:px-5">
            <div>
              <h2 class="text-[14px] font-semibold text-ink">
                {{ t('iqDetection.overview.groupsTitle') }}
              </h2>
              <p class="mt-0.5 text-xs text-ink-2">
                {{ t('iqDetection.overview.groupsSubtitle') }}
              </p>
            </div>
            <button
              v-if="overview && overview.groups.length > 0"
              type="button"
              class="btn btn-ghost btn-sm !h-7 !px-2.5 text-xs"
              @click="setTab('settings')"
            >
              <Icon name="cog" size="xs" />
              {{ t('iqDetection.tabs.settings') }}
            </button>
          </div>

          <div
            v-if="loadingOverview && !overview"
            class="py-12 text-center text-sm text-ink-3"
          >
            <span class="animate-pulse">{{ t('common.loading') }}</span>
          </div>

          <!-- Empty State when no groups configured -->
          <div
            v-else-if="!overview || overview.groups.length === 0"
            class="flex flex-col items-center justify-center px-6 py-12 text-center"
            data-testid="iq-empty-groups"
          >
            <span
              class="inline-flex h-11 w-11 items-center justify-center rounded-field bg-primary-50 text-primary-700"
            >
              <Icon name="brain" size="lg" />
            </span>
            <h3 class="mt-3 text-sm font-semibold text-ink">
              {{ t('iqDetection.overview.emptyTitle') }}
            </h3>
            <p class="mt-1 max-w-md text-xs text-ink-2">
              {{ t('iqDetection.overview.emptyDescription') }}
            </p>
            <button
              type="button"
              class="btn btn-primary btn-sm mt-4"
              data-testid="iq-goto-settings-btn"
              @click="setTab('settings')"
            >
              <Icon name="cog" size="sm" />
              {{ t('iqDetection.actions.configureGroups') }}
            </button>
          </div>

          <template v-else>
            <!-- Desktop Dense Table (md+) -->
            <div class="hidden overflow-x-auto md:block" data-testid="iq-groups-table-wrap">
              <table class="w-full divide-y divide-edge text-xs">
                <thead class="bg-surface-2">
                  <tr v-if="isDualBenchmarkEnabled">
                    <th class="whitespace-nowrap px-4 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colGroup') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colVerdict') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.benchmark.candy_logic') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.benchmark.pelican_svg') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colLastTested') }}
                    </th>
                    <th class="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colActions') }}
                    </th>
                  </tr>
                  <tr v-else>
                    <th class="whitespace-nowrap px-4 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colGroup') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colBenchmark') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colVerdict') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colAccuracy') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colReasoning') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colPerformance') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colLastTested') }}
                    </th>
                    <th class="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-ink-3">
                      {{ t('iqDetection.overview.colActions') }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-edge bg-surface">
                  <tr
                    v-for="group in overview.groups"
                    :key="group.group_id"
                    class="transition-colors hover:bg-surface-2"
                  >
                    <td class="whitespace-nowrap px-4 py-2.5">
                      <div class="flex items-center gap-1.5">
                        <span class="font-semibold text-ink">
                          {{ group.group_name }}
                        </span>
                        <span class="font-mono text-[11px] text-ink-3">#{{ group.group_id }}</span>
                        <span
                          class="rounded px-1.5 py-0.5 text-[10.5px] font-medium"
                          :class="groupStatusBadgeClasses(group.group_status)"
                        >
                          {{ formatGroupStatus(group.group_status) }}
                        </span>
                      </div>
                      <div class="mt-0.5 font-mono text-[11px] tabular-nums text-ink-3">
                        {{
                          t('iqDetection.overview.schedulableCount', {
                            count: group.schedulable_account_count
                          })
                        }}
                      </div>
                    </td>

                    <!-- Dual-Benchmark Side-by-Side Row -->
                    <template v-if="isDualBenchmarkEnabled">
                      <td class="whitespace-nowrap px-3 py-2.5">
                        <span
                          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          :class="verdictBadgeClasses(resolveGroupDisplayVerdict(group))"
                        >
                          <span
                            class="h-1.5 w-1.5 rounded-full"
                            :class="verdictDotClasses(resolveGroupDisplayVerdict(group))"
                          />
                          {{ t(`iqDetection.verdict.${resolveGroupDisplayVerdict(group)}`) }}
                        </span>
                      </td>

                      <!-- Candy Logic Cell -->
                      <td class="whitespace-nowrap px-3 py-2.5">
                        <button
                          v-if="getGroupBenchmarkRun(group, 'candy_logic')"
                          type="button"
                          :data-testid="`iq-group-candy-detail-${group.group_id}`"
                          class="group/cell inline-flex flex-col items-start rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-3"
                          @click="openDetail(getGroupBenchmarkRun(group, 'candy_logic'))"
                        >
                          <div class="flex items-center gap-1.5 font-mono tabular-nums">
                            <span
                              class="h-1.5 w-1.5 shrink-0 rounded-full"
                              :class="verdictDotClasses(getGroupBenchmarkRun(group, 'candy_logic')!.verdict)"
                            />
                            <span class="font-semibold text-ink group-hover/cell:text-primary-700">
                              {{ getGroupBenchmarkRun(group, 'candy_logic')!.correct_count }}/{{
                                getGroupBenchmarkRun(group, 'candy_logic')!.graded_count ||
                                getGroupBenchmarkRun(group, 'candy_logic')!.tests_count
                              }}
                            </span>
                            <span class="font-sans text-[11px] text-ink-2">
                              {{ t(`iqDetection.verdict.${getGroupBenchmarkRun(group, 'candy_logic')!.verdict}`) }}
                            </span>
                          </div>
                          <div class="mt-0.5 font-mono text-[11px] tabular-nums text-ink-3">
                            {{ Math.round(getGroupBenchmarkRun(group, 'candy_logic')!.avg_reasoning_tokens) }} tok ·
                            {{ formatLatencyMs(getGroupBenchmarkRun(group, 'candy_logic')!.avg_latency_ms) }}
                          </div>
                        </button>
                        <span v-else class="px-2 text-ink-3">{{ t('iqDetection.verdict.untested') }}</span>
                      </td>

                      <!-- Pelican SVG Cell -->
                      <td class="whitespace-nowrap px-3 py-2.5">
                        <button
                          v-if="getGroupBenchmarkRun(group, 'pelican_svg')"
                          type="button"
                          :data-testid="`iq-group-pelican-detail-${group.group_id}`"
                          class="group/cell inline-flex flex-col items-start rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-3"
                          @click="openDetail(getGroupBenchmarkRun(group, 'pelican_svg'))"
                        >
                          <div class="flex items-center gap-1.5 font-mono tabular-nums">
                            <span
                              class="h-1.5 w-1.5 shrink-0 rounded-full"
                              :class="verdictDotClasses(getGroupBenchmarkRun(group, 'pelican_svg')!.verdict)"
                            />
                            <span
                              class="font-bold"
                              :class="scoreTextClasses(getGroupBenchmarkRun(group, 'pelican_svg')!.avg_score ?? 0)"
                            >
                              {{
                                t('iqDetection.pelican.scoreUnit', {
                                  score: Math.round(getGroupBenchmarkRun(group, 'pelican_svg')!.avg_score ?? 0)
                                })
                              }}
                            </span>
                            <span class="font-sans text-[11px] text-ink-2">
                              {{ t(`iqDetection.verdict.${getGroupBenchmarkRun(group, 'pelican_svg')!.verdict}`) }}
                            </span>
                          </div>
                          <div class="mt-0.5 font-mono text-[11px] tabular-nums text-ink-3">
                            {{ Math.round(getGroupBenchmarkRun(group, 'pelican_svg')!.avg_reasoning_tokens) }} tok ·
                            {{ formatLatencyMs(getGroupBenchmarkRun(group, 'pelican_svg')!.avg_latency_ms) }}
                          </div>
                        </button>
                        <span v-else class="px-2 text-ink-3">{{ t('iqDetection.verdict.untested') }}</span>
                      </td>
                    </template>

                    <!-- Single-Benchmark Row -->
                    <template v-else>
                      <td class="whitespace-nowrap px-3 py-2.5">
                        <span
                          v-if="primaryGroupRun(group)"
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          :class="benchmarkBadgeClasses(normalizeBenchmarkType(primaryGroupRun(group)!.benchmark_type))"
                        >
                          {{ t(`iqDetection.benchmark.${normalizeBenchmarkType(primaryGroupRun(group)!.benchmark_type)}`) }}
                        </span>
                        <span v-else class="text-ink-3">—</span>
                      </td>

                      <td class="whitespace-nowrap px-3 py-2.5">
                        <span
                          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          :class="verdictBadgeClasses(resolveGroupDisplayVerdict(group))"
                        >
                          <span
                            class="h-1.5 w-1.5 rounded-full"
                            :class="verdictDotClasses(resolveGroupDisplayVerdict(group))"
                          />
                          {{ t(`iqDetection.verdict.${resolveGroupDisplayVerdict(group)}`) }}
                        </span>
                      </td>

                      <td class="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums">
                        <template v-if="primaryGroupRun(group)">
                          <template v-if="normalizeBenchmarkType(primaryGroupRun(group)!.benchmark_type) === 'pelican_svg'">
                            <span
                              class="font-bold"
                              :class="scoreTextClasses(primaryGroupRun(group)!.avg_score ?? 0)"
                            >
                              {{ t('iqDetection.pelican.scoreUnit', { score: Math.round(primaryGroupRun(group)!.avg_score ?? 0) }) }}
                            </span>
                            <span class="ml-1 text-[11px] text-ink-3">
                              ({{ primaryGroupRun(group)!.correct_count }}/{{ primaryGroupRun(group)!.graded_count || primaryGroupRun(group)!.tests_count }})
                            </span>
                          </template>
                          <span v-else class="font-semibold text-ink">
                            {{ primaryGroupRun(group)!.correct_count }}/{{
                              primaryGroupRun(group)!.graded_count || primaryGroupRun(group)!.tests_count
                            }}
                          </span>
                        </template>
                        <span v-else class="text-ink-3">—</span>
                      </td>

                      <td class="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-ink-2">
                        <template v-if="primaryGroupRun(group)">
                          <span class="font-semibold text-primary-700">
                            {{ Math.round(primaryGroupRun(group)!.avg_reasoning_tokens) }}
                          </span>
                          <span class="text-ink-3"> / </span>
                          <span>{{ Math.round(primaryGroupRun(group)!.avg_output_tokens) }}</span>
                        </template>
                        <span v-else class="text-ink-3">—</span>
                      </td>

                      <td class="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-ink-2">
                        <template v-if="primaryGroupRun(group)">
                          <div>{{ formatLatencyMs(primaryGroupRun(group)!.avg_latency_ms) }}</div>
                          <div class="text-[11px] text-ink-3">{{ formatTps(primaryGroupRun(group)!.avg_tps) }}</div>
                        </template>
                        <span v-else class="text-ink-3">—</span>
                      </td>
                    </template>

                    <td class="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-ink-2">
                      <template v-if="primaryGroupRun(group)">
                        <div class="text-ink">
                          {{ primaryGroupRun(group)!.response_model || primaryGroupRun(group)!.requested_model || '—' }}
                        </div>
                        <div class="mt-0.5 text-[11px] text-ink-3">
                          {{ formatDateTime(primaryGroupRun(group)!.completed_at) }} ·
                          {{ t(`iqDetection.trigger.${primaryGroupRun(group)!.trigger_type}`) }}
                        </div>
                      </template>
                      <span v-else class="text-ink-3">{{ t('iqDetection.overview.noRecentRun') }}</span>
                    </td>

                    <td class="whitespace-nowrap px-4 py-2.5 text-right">
                      <div class="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm !h-7 !px-2.5"
                          :data-testid="`iq-run-group-${group.group_id}`"
                          :disabled="
                            runningAll ||
                            isGroupRunning(group.group_id, group.in_flight) ||
                            group.group_status === 'missing'
                          "
                          @click="handleRunSingleGroup(group.group_id)"
                        >
                          <Icon name="play" size="xs" />
                          {{
                            isGroupRunning(group.group_id, group.in_flight)
                              ? t('iqDetection.actions.runningGroup')
                              : t('iqDetection.actions.runGroup')
                          }}
                        </button>

                        <button
                          v-if="primaryGroupRun(group)"
                          type="button"
                          class="btn btn-secondary btn-sm !h-7 !px-2.5"
                          :data-testid="`iq-group-detail-${group.group_id}`"
                          @click="openDetail(primaryGroupRun(group))"
                        >
                          <Icon name="eye" size="xs" />
                          {{ t('iqDetection.actions.viewDetails') }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile Stacked Rows (<md) -->
            <div class="divide-y divide-edge md:hidden">
              <div
                v-for="group in overview.groups"
                :key="`m-${group.group_id}`"
                class="space-y-2.5 px-4 py-3.5"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="font-semibold text-ink">{{ group.group_name }}</span>
                      <span class="font-mono text-[11px] text-ink-3">#{{ group.group_id }}</span>
                      <span
                        class="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        :class="groupStatusBadgeClasses(group.group_status)"
                      >
                        {{ formatGroupStatus(group.group_status) }}
                      </span>
                    </div>
                    <div class="mt-0.5 font-mono text-[11px] tabular-nums text-ink-3">
                      {{
                        t('iqDetection.overview.schedulableCount', {
                          count: group.schedulable_account_count
                        })
                      }}
                      <template v-if="primaryGroupRun(group)">
                        · {{ formatDateTime(primaryGroupRun(group)!.completed_at) }}
                      </template>
                    </div>
                  </div>

                  <span
                    class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    :class="verdictBadgeClasses(resolveGroupDisplayVerdict(group))"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      :class="verdictDotClasses(resolveGroupDisplayVerdict(group))"
                    />
                    {{ t(`iqDetection.verdict.${resolveGroupDisplayVerdict(group)}`) }}
                  </span>
                </div>

                <!-- Dual-benchmark mobile pills -->
                <div
                  v-if="isDualBenchmarkEnabled"
                  class="grid grid-cols-2 gap-2 text-xs"
                >
                  <button
                    type="button"
                    class="flex flex-col items-start rounded-lg border border-edge bg-surface-2 px-2.5 py-2 text-left"
                    :disabled="!getGroupBenchmarkRun(group, 'candy_logic')"
                    @click="openDetail(getGroupBenchmarkRun(group, 'candy_logic'))"
                  >
                    <span class="text-[11px] font-semibold text-ink-2">
                      {{ t('iqDetection.benchmark.candy_logic') }}
                    </span>
                    <span
                      v-if="getGroupBenchmarkRun(group, 'candy_logic')"
                      class="mt-0.5 font-mono font-semibold tabular-nums text-ink"
                    >
                      {{ getGroupBenchmarkRun(group, 'candy_logic')!.correct_count }}/{{
                        getGroupBenchmarkRun(group, 'candy_logic')!.graded_count ||
                        getGroupBenchmarkRun(group, 'candy_logic')!.tests_count
                      }}
                    </span>
                    <span v-else class="mt-0.5 text-[11px] text-ink-3">
                      {{ t('iqDetection.verdict.untested') }}
                    </span>
                  </button>

                  <button
                    type="button"
                    class="flex flex-col items-start rounded-lg border border-edge bg-surface-2 px-2.5 py-2 text-left"
                    :disabled="!getGroupBenchmarkRun(group, 'pelican_svg')"
                    @click="openDetail(getGroupBenchmarkRun(group, 'pelican_svg'))"
                  >
                    <span class="text-[11px] font-semibold text-primary-700">
                      {{ t('iqDetection.benchmark.pelican_svg') }}
                    </span>
                    <span
                      v-if="getGroupBenchmarkRun(group, 'pelican_svg')"
                      class="mt-0.5 font-mono font-bold tabular-nums"
                      :class="scoreTextClasses(getGroupBenchmarkRun(group, 'pelican_svg')!.avg_score ?? 0)"
                    >
                      {{
                        t('iqDetection.pelican.scoreUnit', {
                          score: Math.round(getGroupBenchmarkRun(group, 'pelican_svg')!.avg_score ?? 0)
                        })
                      }}
                    </span>
                    <span v-else class="mt-0.5 text-[11px] text-ink-3">
                      {{ t('iqDetection.verdict.untested') }}
                    </span>
                  </button>
                </div>

                <!-- Single-benchmark mobile telemetry -->
                <div
                  v-else-if="primaryGroupRun(group)"
                  class="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-ink-2"
                >
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold"
                    :class="benchmarkBadgeClasses(normalizeBenchmarkType(primaryGroupRun(group)!.benchmark_type))"
                  >
                    {{ t(`iqDetection.benchmark.${normalizeBenchmarkType(primaryGroupRun(group)!.benchmark_type)}`) }}
                  </span>
                  <span
                    v-if="normalizeBenchmarkType(primaryGroupRun(group)!.benchmark_type) === 'pelican_svg'"
                    :class="scoreTextClasses(primaryGroupRun(group)!.avg_score ?? 0)"
                    class="font-bold"
                  >
                    {{ t('iqDetection.pelican.scoreUnit', { score: Math.round(primaryGroupRun(group)!.avg_score ?? 0) }) }}
                  </span>
                  <span v-else class="font-semibold text-ink">
                    {{ primaryGroupRun(group)!.correct_count }}/{{ primaryGroupRun(group)!.graded_count || primaryGroupRun(group)!.tests_count }}
                  </span>
                  <span>· {{ Math.round(primaryGroupRun(group)!.avg_reasoning_tokens) }}/{{ Math.round(primaryGroupRun(group)!.avg_output_tokens) }} tok</span>
                  <span>· {{ formatLatencyMs(primaryGroupRun(group)!.avg_latency_ms) }}</span>
                </div>

                <div class="flex items-center justify-end gap-2 pt-0.5">
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm !h-7 !px-2.5"
                    :disabled="
                      runningAll ||
                      isGroupRunning(group.group_id, group.in_flight) ||
                      group.group_status === 'missing'
                    "
                    @click="handleRunSingleGroup(group.group_id)"
                  >
                    <Icon name="play" size="xs" />
                    {{
                      isGroupRunning(group.group_id, group.in_flight)
                        ? t('iqDetection.actions.runningGroup')
                        : t('iqDetection.actions.runGroup')
                    }}
                  </button>
                  <button
                    v-if="primaryGroupRun(group)"
                    type="button"
                    class="btn btn-secondary btn-sm !h-7 !px-2.5"
                    @click="openDetail(primaryGroupRun(group))"
                  >
                    <Icon name="eye" size="xs" />
                    {{ t('iqDetection.actions.viewDetails') }}
                  </button>
                </div>
              </div>
            </div>
          </template>
        </section>

        <!-- Band 3: Pelican SVG Live Animation Comparison Gallery -->
        <IQDetectionPelicanGallery
          v-if="showPelicanGallery"
          :runs="pelicanGalleryRuns"
          :running="runningAll"
          @inspect="openDetail"
          @run-pelican="handleRunPelicanNow"
        />

        <!-- Band 4: Detection History -->
        <section class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
          <div
            class="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-surface-2 px-4 py-3 sm:px-5"
          >
            <div>
              <h2 class="text-[14px] font-semibold text-ink">
                {{ t('iqDetection.history.title') }}
              </h2>
              <p class="mt-0.5 text-xs text-ink-2">
                {{ t('iqDetection.history.subtitle') }}
              </p>
            </div>

            <!-- Compact custom Select filters matching Sub2API toolbar craft -->
            <div class="flex flex-wrap items-center gap-2">
              <Select
                :model-value="historyGroupFilter"
                :options="historyGroupSelectOptions"
                searchable="auto"
                size="sm"
                align="right"
                data-testid="iq-history-group-filter"
                :aria-label="t('iqDetection.history.colGroup')"
                class="iq-toolbar-select w-[148px]"
                :class="historyGroupFilter > 0 && 'iq-filter-active'"
                @update:model-value="onHistoryGroupFilterChange"
              >
                <template #selected="{ option }">
                  <span class="inline-flex min-w-0 items-center gap-1.5">
                    <Icon
                      name="cube"
                      size="xs"
                      class="shrink-0"
                      :class="historyGroupFilter > 0 ? 'text-primary-600 dark:text-primary-400' : 'text-ink-3'"
                    />
                    <span class="truncate">{{ option?.label }}</span>
                    <span
                      v-if="option?.groupId"
                      class="shrink-0 font-mono text-[10.5px] text-ink-3"
                    >
                      #{{ option.groupId }}
                    </span>
                  </span>
                </template>
                <template #option="{ option, selected }">
                  <span class="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span class="truncate">{{ option.label }}</span>
                    <span
                      v-if="option.groupId"
                      class="shrink-0 font-mono text-[10.5px] text-ink-3"
                    >
                      #{{ option.groupId }}
                    </span>
                  </span>
                  <Icon
                    v-if="selected"
                    name="check"
                    size="xs"
                    class="shrink-0 text-primary-600 dark:text-primary-400"
                    :stroke-width="2.2"
                  />
                </template>
              </Select>

              <Select
                :model-value="historyBenchmarkFilter"
                :options="historyBenchmarkSelectOptions"
                :searchable="false"
                size="sm"
                align="right"
                data-testid="iq-history-benchmark-filter"
                :aria-label="t('iqDetection.history.colBenchmark')"
                class="iq-toolbar-select w-[144px]"
                :class="historyBenchmarkFilter && 'iq-filter-active'"
                @update:model-value="onHistoryBenchmarkFilterChange"
              >
                <template #selected="{ option }">
                  <span class="inline-flex min-w-0 items-center gap-1.5">
                    <Icon
                      :name="historyBenchmarkOptionIcon(option?.value)"
                      size="xs"
                      class="shrink-0"
                      :class="
                        option?.value === 'pelican_svg'
                          ? 'text-primary-600 dark:text-primary-400'
                          : option?.value === 'candy_logic'
                            ? 'text-ink-2'
                            : 'text-ink-3'
                      "
                    />
                    <span class="truncate">{{ option?.label }}</span>
                  </span>
                </template>
                <template #option="{ option, selected }">
                  <span class="inline-flex min-w-0 flex-1 items-center gap-2">
                    <Icon
                      :name="historyBenchmarkOptionIcon(option.value)"
                      size="xs"
                      class="shrink-0"
                      :class="
                        option.value === 'pelican_svg'
                          ? 'text-primary-600 dark:text-primary-400'
                          : option.value === 'candy_logic'
                            ? 'text-ink-2'
                            : 'text-ink-3'
                      "
                    />
                    <span class="truncate">{{ option.label }}</span>
                  </span>
                  <Icon
                    v-if="selected"
                    name="check"
                    size="xs"
                    class="shrink-0 text-primary-600 dark:text-primary-400"
                    :stroke-width="2.2"
                  />
                </template>
              </Select>

              <Select
                :model-value="historyVerdictFilter"
                :options="historyVerdictSelectOptions"
                :searchable="false"
                size="sm"
                align="right"
                data-testid="iq-history-verdict-filter"
                :aria-label="t('iqDetection.history.colVerdict')"
                class="iq-toolbar-select w-[124px]"
                :class="historyVerdictFilter && 'iq-filter-active'"
                @update:model-value="onHistoryVerdictFilterChange"
              >
                <template #selected="{ option }">
                  <span class="inline-flex min-w-0 items-center gap-1.5">
                    <span
                      class="h-1.5 w-1.5 shrink-0 rounded-full"
                      :class="option?.dotClass || 'border border-ink-3/70 bg-transparent'"
                      aria-hidden="true"
                    />
                    <span class="truncate">{{ option?.label }}</span>
                  </span>
                </template>
                <template #option="{ option, selected }">
                  <span class="inline-flex min-w-0 flex-1 items-center gap-2">
                    <span
                      class="h-1.5 w-1.5 shrink-0 rounded-full"
                      :class="option.dotClass || 'border border-ink-3/70 bg-transparent'"
                      aria-hidden="true"
                    />
                    <span class="truncate">{{ option.label }}</span>
                  </span>
                  <Icon
                    v-if="selected"
                    name="check"
                    size="xs"
                    class="shrink-0 text-primary-600 dark:text-primary-400"
                    :stroke-width="2.2"
                  />
                </template>
              </Select>

              <button
                v-if="hasActiveHistoryFilters"
                type="button"
                data-testid="iq-history-reset-filters"
                class="btn btn-ghost btn-sm !h-8 !px-2.5 text-xs text-ink-2 hover:text-ink"
                @click="resetHistoryFilters"
              >
                <Icon name="x" size="xs" />
                {{ t('iqDetection.history.resetFilters') }}
              </button>
            </div>
          </div>

          <div
            v-if="loadingHistory && historyRuns.length === 0"
            class="py-12 text-center text-sm text-ink-3"
          >
            <span class="animate-pulse">{{ t('common.loading') }}</span>
          </div>

          <div
            v-else-if="historyRuns.length === 0"
            class="px-6 py-10 text-center"
            data-testid="iq-empty-history"
          >
            <div class="text-sm font-medium text-ink">
              {{ t('iqDetection.history.emptyTitle') }}
            </div>
            <p class="mt-1 text-xs text-ink-2">
              {{ t('iqDetection.history.emptyDescription') }}
            </p>
          </div>

          <template v-else>
            <!-- Desktop History Table (md+) -->
            <div class="hidden overflow-x-auto md:block" data-testid="iq-history-table-wrap">
              <table class="w-full divide-y divide-edge text-xs">
                <thead class="bg-surface-2">
                  <tr>
                    <th class="whitespace-nowrap px-4 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.history.colTime') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.history.colGroup') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.history.colBenchmark') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.history.colVerdict') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.history.colLatencyTps') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.history.colModel') }}
                    </th>
                    <th class="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-ink-3">
                      {{ t('iqDetection.history.colPreview') }}
                    </th>
                    <th class="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-ink-3">
                      {{ t('iqDetection.history.colActions') }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-edge bg-surface">
                  <tr
                    v-for="run in historyRuns"
                    :key="run.id"
                    class="transition-colors hover:bg-surface-2"
                  >
                    <td class="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-ink-2">
                      <div>{{ formatDateTime(run.completed_at) }}</div>
                      <div class="mt-0.5 font-sans text-[11px] text-ink-3">
                        {{ t(`iqDetection.trigger.${run.trigger_type}`) }}
                      </div>
                    </td>

                    <td class="whitespace-nowrap px-3 py-2.5">
                      <span class="font-medium text-ink">{{ run.group_name }}</span>
                      <span class="ml-1 font-mono text-[11px] text-ink-3">#{{ run.group_id }}</span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-2.5">
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        :class="benchmarkBadgeClasses(normalizeBenchmarkType(run.benchmark_type))"
                      >
                        {{ t(`iqDetection.benchmark.${normalizeBenchmarkType(run.benchmark_type)}`) }}
                      </span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-2.5">
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                          :class="verdictBadgeClasses(run.verdict)"
                        >
                          <span class="h-1.5 w-1.5 rounded-full" :class="verdictDotClasses(run.verdict)" />
                          {{ t(`iqDetection.verdict.${run.verdict}`) }}
                        </span>
                        <span class="font-mono tabular-nums">
                          <template v-if="normalizeBenchmarkType(run.benchmark_type) === 'pelican_svg'">
                            <span class="font-bold" :class="scoreTextClasses(run.avg_score ?? 0)">
                              {{ t('iqDetection.pelican.scoreUnit', { score: Math.round(run.avg_score ?? 0) }) }}
                            </span>
                          </template>
                          <span v-else class="font-semibold text-ink">
                            {{ run.correct_count }}/{{ run.graded_count || run.tests_count }}
                          </span>
                        </span>
                      </div>
                    </td>

                    <td class="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-ink-2">
                      <div>
                        <span class="font-semibold text-primary-700">{{ Math.round(run.avg_reasoning_tokens) }}</span>
                        <span class="text-[11px] text-ink-3"> tok</span>
                      </div>
                      <div class="text-[11px] text-ink-3">
                        {{ formatLatencyMs(run.avg_latency_ms) }} · {{ formatTps(run.avg_tps) }}
                      </div>
                    </td>

                    <td class="whitespace-nowrap px-3 py-2.5 font-mono text-ink-2">
                      <div>{{ run.requested_model }}</div>
                      <div
                        v-if="run.response_model && run.response_model !== run.requested_model"
                        class="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300"
                      >
                        <Icon name="arrowRight" size="xs" />
                        <span>{{ run.response_model }}</span>
                      </div>
                    </td>

                    <td class="max-w-[240px] truncate px-3 py-2.5 font-mono text-ink-2 xl:max-w-[320px]">
                      <span v-if="run.error_message" class="text-red-700 dark:text-red-300">
                        {{ run.error_message }}
                      </span>
                      <span v-else>{{ run.answer_preview || '—' }}</span>
                    </td>

                    <td class="whitespace-nowrap px-4 py-2.5 text-right">
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm !h-7 !px-2.5"
                        :data-testid="`iq-history-detail-${run.id}`"
                        @click="openDetail(run)"
                      >
                        <Icon name="eye" size="xs" />
                        {{ t('iqDetection.actions.viewDetails') }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile History Stacked Rows (<md) -->
            <div class="divide-y divide-edge md:hidden">
              <div
                v-for="run in historyRuns"
                :key="`mh-${run.id}`"
                class="space-y-2 px-4 py-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-semibold text-ink">{{ run.group_name }}</span>
                      <span class="font-mono text-[11px] text-ink-3">#{{ run.group_id }}</span>
                    </div>
                    <div class="mt-0.5 font-mono text-[11px] tabular-nums text-ink-3">
                      {{ formatDateTime(run.completed_at) }} · {{ t(`iqDetection.trigger.${run.trigger_type}`) }}
                    </div>
                  </div>
                  <span
                    class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    :class="verdictBadgeClasses(run.verdict)"
                  >
                    <span class="h-1.5 w-1.5 rounded-full" :class="verdictDotClasses(run.verdict)" />
                    {{ t(`iqDetection.verdict.${run.verdict}`) }}
                  </span>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div class="flex flex-wrap items-center gap-2 font-mono tabular-nums text-ink-2">
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold"
                      :class="benchmarkBadgeClasses(normalizeBenchmarkType(run.benchmark_type))"
                    >
                      {{ t(`iqDetection.benchmark.${normalizeBenchmarkType(run.benchmark_type)}`) }}
                    </span>
                    <span v-if="normalizeBenchmarkType(run.benchmark_type) === 'pelican_svg'" :class="scoreTextClasses(run.avg_score ?? 0)" class="font-bold">
                      {{ t('iqDetection.pelican.scoreUnit', { score: Math.round(run.avg_score ?? 0) }) }}
                    </span>
                    <span v-else class="font-semibold text-ink">
                      {{ run.correct_count }}/{{ run.graded_count || run.tests_count }}
                    </span>
                    <span>· {{ formatLatencyMs(run.avg_latency_ms) }}</span>
                  </div>

                  <button
                    type="button"
                    class="btn btn-secondary btn-sm !h-7 !px-2.5"
                    @click="openDetail(run)"
                  >
                    <Icon name="eye" size="xs" />
                    {{ t('iqDetection.actions.viewDetails') }}
                  </button>
                </div>
              </div>
            </div>
          </template>

          <div v-if="historyTotal > 0" class="iq-pagination">
            <Pagination
              :page="historyPage"
              :page-size="historyPageSize"
              :total="historyTotal"
              @update:page="onHistoryPageChange"
              @update:page-size="onHistoryPageSizeChange"
            />
          </div>
        </section>
      </template>
    </div>

    <IQDetectionRunDetailDialog
      :show="Boolean(detailRun)"
      :run="detailRun"
      @close="detailRun = null"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import AppLayout from '@/components/layout/AppLayout.vue'
import Pagination from '@/components/common/Pagination.vue'
import Select, { type SelectOption } from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import {
  getIQDetectionOverview,
  listIQDetectionRuns,
  runIQDetectionNow
} from './api'
import type {
  IQDetectionBenchmarkType,
  IQDetectionConfig,
  IQDetectionGroupStatus,
  IQDetectionOverview,
  IQDetectionRun,
  IQDetectionRunNowInput,
  IQDetectionVerdict
} from './types'
import {
  benchmarkBadgeClasses,
  type DisplayVerdict,
  formatDateTime,
  formatLatencyMs,
  formatTps,
  normalizeBenchmarkType,
  resolveConfigBenchmarkTypes,
  resolveConfigIntervalMinutes,
  scoreTextClasses,
  verdictBadgeClasses,
  verdictDotClasses
} from './verdictMeta'
import IQDetectionSettingsPanel from './IQDetectionSettingsPanel.vue'
import IQDetectionRunDetailDialog from './IQDetectionRunDetailDialog.vue'
import IQDetectionPelicanGallery from './IQDetectionPelicanGallery.vue'

type ActiveTab = 'overview' | 'settings'
type ManualRunSelection = IQDetectionBenchmarkType | 'both'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const activeTab = ref<ActiveTab>(route.query.tab === 'settings' ? 'settings' : 'overview')
const loadingOverview = ref(false)
const loadingHistory = ref(false)
const runningAll = ref(false)
const runningGroupIds = ref<Set<number>>(new Set())

const overview = ref<IQDetectionOverview | null>(null)
const historyRuns = ref<IQDetectionRun[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const historyPageSize = ref(getPersistedPageSize(20))
const historyGroupFilter = ref(0)
const historyBenchmarkFilter = ref<IQDetectionBenchmarkType | ''>('')
const historyVerdictFilter = ref<IQDetectionVerdict | ''>('')
const manualRunBenchmark = ref<ManualRunSelection>('candy_logic')
const manualRunBenchmarkTouched = ref(false)

const detailRun = ref<IQDetectionRun | null>(null)

const enabledBenchmarks = computed<IQDetectionBenchmarkType[]>(() =>
  resolveConfigBenchmarkTypes(overview.value?.config)
)

const isDualBenchmarkEnabled = computed(() => enabledBenchmarks.value.length > 1)

function resolveDefaultManualSelection(cfg?: IQDetectionConfig | null): ManualRunSelection {
  const types = resolveConfigBenchmarkTypes(cfg)
  return types.length > 1 ? 'both' : types[0]
}

function getGroupBenchmarkRun(
  group: IQDetectionGroupStatus,
  bench: IQDetectionBenchmarkType
): IQDetectionRun | null {
  const mapped = group.latest_runs_by_benchmark?.[bench]
  if (mapped) return mapped
  if (group.latest_run && normalizeBenchmarkType(group.latest_run.benchmark_type) === bench) {
    return group.latest_run
  }
  return null
}

function primaryGroupRun(group: IQDetectionGroupStatus): IQDetectionRun | null {
  if (isDualBenchmarkEnabled.value) {
    return (
      group.latest_run ??
      getGroupBenchmarkRun(group, 'pelican_svg') ??
      getGroupBenchmarkRun(group, 'candy_logic')
    )
  }
  return getGroupBenchmarkRun(group, enabledBenchmarks.value[0]) ?? group.latest_run
}

const pelicanGalleryRuns = computed<IQDetectionRun[]>(() => {
  const byGroup = new Map<number, IQDetectionRun>()
  for (const g of overview.value?.groups ?? []) {
    const pelicanRun = getGroupBenchmarkRun(g, 'pelican_svg')
    if (pelicanRun) {
      byGroup.set(g.group_id, pelicanRun)
    }
  }
  for (const run of historyRuns.value) {
    if (normalizeBenchmarkType(run.benchmark_type) === 'pelican_svg' && !byGroup.has(run.group_id)) {
      byGroup.set(run.group_id, run)
    }
  }
  return Array.from(byGroup.values())
})

const showPelicanGallery = computed(() => {
  if ((overview.value?.groups.length ?? 0) === 0 && pelicanGalleryRuns.value.length === 0) {
    return false
  }
  return (
    pelicanGalleryRuns.value.length > 0 ||
    enabledBenchmarks.value.includes('pelican_svg') ||
    manualRunBenchmark.value === 'pelican_svg' ||
    manualRunBenchmark.value === 'both'
  )
})

const mismatchSummary = computed<{
  groups: IQDetectionGroupStatus[]
  selection: ManualRunSelection
  targetLabel: string
  hasScheduledConflict: boolean
} | null>(() => {
  const groups = overview.value?.groups ?? []
  const missingBenchSet = new Set<IQDetectionBenchmarkType>()
  const affectedGroups: IQDetectionGroupStatus[] = []

  for (const g of groups) {
    const hasAnyRun =
      Boolean(g.latest_run) ||
      Boolean(g.latest_runs_by_benchmark?.candy_logic) ||
      Boolean(g.latest_runs_by_benchmark?.pelican_svg)
    if (!hasAnyRun) continue

    let groupMissing = false
    for (const bench of enabledBenchmarks.value) {
      if (!getGroupBenchmarkRun(g, bench)) {
        missingBenchSet.add(bench)
        groupMissing = true
      }
    }
    if (groupMissing) {
      affectedGroups.push(g)
    }
  }

  if (affectedGroups.length === 0 || missingBenchSet.size === 0) {
    return null
  }

  const missingList = Array.from(missingBenchSet)
  const selection: ManualRunSelection = missingList.length > 1 ? 'both' : missingList[0]
  const targetLabel =
    selection === 'both'
      ? `${t('iqDetection.benchmark.candy_logic')} + ${t('iqDetection.benchmark.pelican_svg')}`
      : t(`iqDetection.benchmark.${selection}`)
  const hasScheduledConflict = affectedGroups.some(
    (g) => g.latest_run?.trigger_type === 'scheduled'
  )

  return {
    groups: affectedGroups,
    selection,
    targetLabel,
    hasScheduledConflict
  }
})

const summarySegments = computed(() => {
  const total = overview.value?.summary.configured_count ?? 0
  if (total <= 0) {
    return { normal: 0, warning: 0, degraded: 0, other: 0 }
  }
  const normal = ((overview.value?.summary.normal_count ?? 0) / total) * 100
  const warning = ((overview.value?.summary.warning_count ?? 0) / total) * 100
  const degraded = ((overview.value?.summary.degraded_count ?? 0) / total) * 100
  const other = Math.max(0, 100 - normal - warning - degraded)
  return { normal, warning, degraded, other }
})

const readinessRatioLabel = computed(() => {
  const total = overview.value?.summary.configured_count ?? 0
  if (total <= 0) return '—'
  const normal = overview.value?.summary.normal_count ?? 0
  return `${Math.round((normal / total) * 100)}%`
})

let overviewAbort: AbortController | null = null
let historyAbort: AbortController | null = null

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = tab === 'settings' ? 'settings' : 'overview'
  }
)

function setTab(next: ActiveTab): void {
  activeTab.value = next
  const nextQuery = { ...route.query }
  if (next === 'overview') {
    delete nextQuery.tab
  } else {
    nextQuery.tab = next
  }
  router.replace({ query: nextQuery }).catch(() => {})
}

const historyGroupOptions = computed(() => {
  const map = new Map<number, string>()
  for (const g of overview.value?.groups ?? []) {
    map.set(g.group_id, g.group_name)
  }
  for (const r of historyRuns.value) {
    if (!map.has(r.group_id)) {
      map.set(r.group_id, r.group_name)
    }
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
})

const manualRunBenchmarkOptions = computed<SelectOption[]>(() => {
  const candyRounds = overview.value?.config.tests_per_group || 1
  return [
    {
      value: 'both',
      label: t('iqDetection.benchmark.bothOption'),
      meta: `${t('iqDetection.overview.testsPerGroupShort', { n: candyRounds })} + ${t('iqDetection.benchmark.pelicanFixedBadge')}`
    },
    {
      value: 'candy_logic',
      label: t('iqDetection.benchmark.candy_logic'),
      meta: t('iqDetection.overview.testsPerGroupShort', { n: candyRounds })
    },
    {
      value: 'pelican_svg',
      label: t('iqDetection.benchmark.pelican_svg'),
      meta: t('iqDetection.benchmark.pelicanFixedBadge')
    }
  ]
})

const historyGroupSelectOptions = computed<SelectOption[]>(() => [
  {
    value: 0,
    label: t('iqDetection.history.filterGroupAll')
  },
  ...historyGroupOptions.value.map((opt) => ({
    value: opt.id,
    label: opt.name,
    groupId: opt.id
  }))
])

const historyBenchmarkSelectOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('iqDetection.history.filterBenchmarkAll') },
  { value: 'candy_logic', label: t('iqDetection.benchmark.candy_logic') },
  { value: 'pelican_svg', label: t('iqDetection.benchmark.pelican_svg') }
])

const historyVerdictSelectOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('iqDetection.history.filterVerdictAll'), dotClass: '' },
  { value: 'normal', label: t('iqDetection.verdict.normal'), dotClass: 'bg-emerald-500' },
  { value: 'warning', label: t('iqDetection.verdict.warning'), dotClass: 'bg-amber-500' },
  { value: 'degraded', label: t('iqDetection.verdict.degraded'), dotClass: 'bg-rose-500' },
  { value: 'error', label: t('iqDetection.verdict.error'), dotClass: 'bg-red-500' }
])

const hasActiveHistoryFilters = computed(
  () =>
    historyGroupFilter.value > 0 ||
    historyBenchmarkFilter.value !== '' ||
    historyVerdictFilter.value !== ''
)

function manualRunOptionIcon(value: unknown): 'grid' | 'brain' | 'sparkles' {
  if (value === 'pelican_svg') return 'sparkles'
  if (value === 'candy_logic') return 'brain'
  return 'grid'
}

function historyBenchmarkOptionIcon(value: unknown): 'filter' | 'brain' | 'sparkles' {
  if (value === 'pelican_svg') return 'sparkles'
  if (value === 'candy_logic') return 'brain'
  return 'filter'
}

function onManualRunBenchmarkChange(val: string | number | boolean | null): void {
  if (val === 'both' || val === 'candy_logic' || val === 'pelican_svg') {
    manualRunBenchmark.value = val
    manualRunBenchmarkTouched.value = true
  }
}

function onHistoryGroupFilterChange(val: string | number | boolean | null): void {
  const parsed = typeof val === 'number' ? val : Number(val ?? 0)
  historyGroupFilter.value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  onFilterChange()
}

function onHistoryBenchmarkFilterChange(val: string | number | boolean | null): void {
  historyBenchmarkFilter.value = val === 'candy_logic' || val === 'pelican_svg' ? val : ''
  onFilterChange()
}

function onHistoryVerdictFilterChange(val: string | number | boolean | null): void {
  historyVerdictFilter.value =
    val === 'normal' || val === 'warning' || val === 'degraded' || val === 'error' ? val : ''
  onFilterChange()
}

function resetHistoryFilters(): void {
  historyGroupFilter.value = 0
  historyBenchmarkFilter.value = ''
  historyVerdictFilter.value = ''
  onFilterChange()
}

function isGroupRunning(groupId: number, backendInFlight: boolean): boolean {
  return backendInFlight || runningGroupIds.value.has(groupId)
}

function verdictSeverityRank(verdict: IQDetectionVerdict): number {
  switch (verdict) {
    case 'error':
      return 4
    case 'degraded':
      return 3
    case 'warning':
      return 2
    case 'normal':
      return 1
  }
}

function resolveGroupDisplayVerdict(group: IQDetectionGroupStatus): DisplayVerdict {
  if (isGroupRunning(group.group_id, group.in_flight)) {
    return 'inFlight'
  }
  let worst: IQDetectionVerdict | null = null
  for (const bench of enabledBenchmarks.value) {
    const r = getGroupBenchmarkRun(group, bench)
    if (r && (!worst || verdictSeverityRank(r.verdict) > verdictSeverityRank(worst))) {
      worst = r.verdict
    }
  }
  if (worst) return worst
  return group.latest_run?.verdict ?? 'untested'
}

function formatPatrolEnabledBadge(cfg: IQDetectionConfig): string {
  const mins = resolveConfigIntervalMinutes(cfg)
  if (mins < 60) {
    return t('iqDetection.overview.patrolEnabledMinutesBadge', { minutes: mins })
  }
  return t('iqDetection.overview.patrolEnabledHoursBadge', { hours: mins / 60 })
}

function formatGroupStatus(status: string): string {
  if (status === 'active' || status === 'inactive' || status === 'missing') {
    return t(`iqDetection.groupStatus.${status}`)
  }
  return status
}

function groupStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
    case 'missing':
      return 'bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300'
    default:
      return 'bg-surface-3 text-ink-2'
  }
}

async function loadOverview(): Promise<void> {
  overviewAbort?.abort()
  const controller = new AbortController()
  overviewAbort = controller
  loadingOverview.value = true
  try {
    overview.value = await getIQDetectionOverview(controller.signal)
    if (!manualRunBenchmarkTouched.value && overview.value?.config) {
      manualRunBenchmark.value = resolveDefaultManualSelection(overview.value.config)
    }
  } catch (err) {
    if (!axios.isCancel(err)) {
      appStore.showError(extractApiErrorMessage(err, t('common.unknownError')))
    }
  } finally {
    if (overviewAbort === controller) {
      loadingOverview.value = false
    }
  }
}

async function loadHistory(): Promise<void> {
  historyAbort?.abort()
  const controller = new AbortController()
  historyAbort = controller
  loadingHistory.value = true
  try {
    const resp = await listIQDetectionRuns(
      {
        page: historyPage.value,
        page_size: historyPageSize.value,
        group_id: historyGroupFilter.value > 0 ? historyGroupFilter.value : undefined,
        verdict: historyVerdictFilter.value || undefined,
        benchmark_type: historyBenchmarkFilter.value || undefined
      },
      controller.signal
    )
    historyRuns.value = resp.items ?? []
    historyTotal.value = resp.total ?? 0
  } catch (err) {
    if (!axios.isCancel(err)) {
      appStore.showError(extractApiErrorMessage(err, t('common.unknownError')))
    }
  } finally {
    if (historyAbort === controller) {
      loadingHistory.value = false
    }
  }
}

async function reloadAll(): Promise<void> {
  await Promise.all([loadOverview(), loadHistory()])
}

function onFilterChange(): void {
  historyPage.value = 1
  void loadHistory()
}

function onHistoryPageChange(page: number): void {
  historyPage.value = page
  void loadHistory()
}

function onHistoryPageSizeChange(size: number): void {
  historyPageSize.value = size
  historyPage.value = 1
  void loadHistory()
}

function openDetail(run: IQDetectionRun | null): void {
  if (!run) return
  detailRun.value = run
}

async function handleConfigSaved(savedCfg: IQDetectionConfig): Promise<void> {
  if (overview.value) {
    overview.value = {
      ...overview.value,
      config: savedCfg
    }
  }
  manualRunBenchmark.value = resolveDefaultManualSelection(savedCfg)
  manualRunBenchmarkTouched.value = false
  await reloadAll()
}

async function handleConfigSavedAndRun(savedCfg: IQDetectionConfig): Promise<void> {
  await handleConfigSaved(savedCfg)
  setTab('overview')
  await handleRunAll()
}

function buildManualRunPayload(
  groupIds?: number[],
  overrideSelection?: ManualRunSelection
): IQDetectionRunNowInput {
  const selection = overrideSelection ?? manualRunBenchmark.value
  const payload: IQDetectionRunNowInput =
    selection === 'both'
      ? { benchmark_types: ['candy_logic', 'pelican_svg'] }
      : { benchmark_type: selection }
  if (groupIds && groupIds.length > 0) {
    payload.group_ids = groupIds
  }
  return payload
}

async function handleRunAll(overrideSelection?: ManualRunSelection): Promise<void> {
  const configuredIds = overview.value?.config.group_ids ?? []
  if (configuredIds.length === 0) {
    appStore.showWarning(t('iqDetection.messages.noGroupsConfigured'))
    setTab('settings')
    return
  }

  const selection =
    typeof overrideSelection === 'string' ? overrideSelection : manualRunBenchmark.value
  manualRunBenchmark.value = selection

  runningAll.value = true
  try {
    const res = await runIQDetectionNow(buildManualRunPayload(undefined, selection))
    notifyBatchResult(res.executed_groups, res.skipped_in_flight_groups?.length ?? 0)
    await reloadAll()
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('common.unknownError')))
  } finally {
    runningAll.value = false
  }
}

async function handleRunMismatchSync(): Promise<void> {
  const target = mismatchSummary.value?.selection ?? resolveDefaultManualSelection(overview.value?.config)
  manualRunBenchmarkTouched.value = false
  await handleRunAll(target)
}

async function handleRunPelicanNow(): Promise<void> {
  manualRunBenchmarkTouched.value = true
  await handleRunAll('pelican_svg')
}

async function handleRunSingleGroup(groupId: number): Promise<void> {
  const nextSet = new Set(runningGroupIds.value)
  nextSet.add(groupId)
  runningGroupIds.value = nextSet

  try {
    const res = await runIQDetectionNow(buildManualRunPayload([groupId]))
    notifyBatchResult(res.executed_groups, res.skipped_in_flight_groups?.length ?? 0)
    await reloadAll()
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('common.unknownError')))
  } finally {
    const cleaned = new Set(runningGroupIds.value)
    cleaned.delete(groupId)
    runningGroupIds.value = cleaned
  }
}

function notifyBatchResult(executed: number, skipped: number): void {
  if (skipped > 0) {
    appStore.showInfo(
      t('iqDetection.messages.runSkippedInFlight', {
        executed,
        skipped
      })
    )
  } else {
    appStore.showSuccess(
      t('iqDetection.messages.runCompleted', {
        executed
      })
    )
  }
}

let inFlightPollTimer: ReturnType<typeof setInterval> | null = null

function syncInFlightPolling(): void {
  const anyBackendInFlight = (overview.value?.groups ?? []).some((g) => g.in_flight)
  if (anyBackendInFlight && !inFlightPollTimer) {
    inFlightPollTimer = setInterval(() => {
      if (!loadingOverview.value && !loadingHistory.value) {
        void reloadAll()
      }
    }, 5000)
  } else if (!anyBackendInFlight && inFlightPollTimer) {
    clearInterval(inFlightPollTimer)
    inFlightPollTimer = null
  }
}

watch(
  () => overview.value?.groups,
  () => {
    syncInFlightPolling()
  },
  { deep: true }
)

onMounted(() => {
  void reloadAll()
})

onUnmounted(() => {
  if (inFlightPollTimer) {
    clearInterval(inFlightPollTimer)
    inFlightPollTimer = null
  }
  overviewAbort?.abort()
  historyAbort?.abort()
})
</script>

<style scoped>
.iq-filter-active :deep(.select-trigger) {
  @apply border-primary-500/50 bg-primary-50/50 text-primary-800 dark:bg-primary-950/35 dark:text-primary-200;
}

.iq-pagination :deep(> div) {
  @apply border-edge bg-surface px-4 py-2.5 text-xs sm:px-5;
}

.iq-pagination :deep(p),
.iq-pagination :deep(span) {
  @apply text-xs text-ink-2;
}

.iq-pagination :deep(.page-size-select) {
  @apply w-[72px];
}

.iq-pagination :deep(.page-size-select .select-trigger) {
  @apply h-8 gap-1 rounded-lg border-edge-strong bg-surface px-2.5 py-1 font-mono text-xs font-medium tabular-nums shadow-xs hover:bg-surface-2;
}

.iq-pagination :deep(.page-size-select .select-icon svg) {
  @apply h-3.5 w-3.5;
}

.iq-pagination :deep(nav button) {
  @apply h-8 border-edge-strong bg-surface px-2.5 py-1 text-xs text-ink-2 hover:bg-surface-2;
}
</style>
