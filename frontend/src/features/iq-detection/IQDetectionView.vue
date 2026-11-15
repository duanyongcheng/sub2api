<template>
  <AppLayout>
    <div class="w-full min-w-0 space-y-6 pb-8">
      <!-- Page Header -->
      <header
        class="page-header mb-0 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700 sm:p-6"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2.5">
              <h1
                class="page-title flex items-center gap-2 text-xl font-black text-gray-900 dark:text-white"
              >
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  <Icon name="brain" size="sm" />
                </span>
                {{ t('iqDetection.title') }}
              </h1>

              <span
                v-if="overview?.config"
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="
                  overview.config.enabled
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-900/25 dark:text-emerald-300 dark:ring-emerald-500/30'
                    : 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/15 dark:bg-dark-700 dark:text-gray-300 dark:ring-dark-600'
                "
              >
                <Icon name="clock" size="xs" />
                {{
                  overview.config.enabled
                    ? formatPatrolEnabledBadge(overview.config)
                    : t('iqDetection.overview.patrolDisabledBadge')
                }}
              </span>

              <span
                v-if="overview?.config"
                class="inline-flex items-center rounded-full bg-blue-50/80 px-2.5 py-0.5 font-mono text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/15 dark:bg-blue-900/25 dark:text-blue-300 dark:ring-blue-500/30"
              >
                {{ overview.config.model }} · {{ overview.config.reasoning_effort }}
              </span>
            </div>

            <p class="page-description mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('iqDetection.description') }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
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
              @click="handleRunAll"
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

        <div class="mt-4 border-t border-gray-100 pt-4 dark:border-dark-700">
          <div
            class="tabs inline-flex w-full max-w-md flex-wrap sm:w-auto"
            role="tablist"
            :aria-label="t('iqDetection.tabs.aria')"
          >
            <button
              type="button"
              role="tab"
              data-testid="iq-tab-overview"
              class="tab flex-1 sm:flex-none"
              :class="activeTab === 'overview' ? 'tab-active' : ''"
              :aria-selected="activeTab === 'overview'"
              @click="setTab('overview')"
            >
              {{ t('iqDetection.tabs.overview') }}
            </button>
            <button
              type="button"
              role="tab"
              data-testid="iq-tab-settings"
              class="tab flex-1 sm:flex-none"
              :class="activeTab === 'settings' ? 'tab-active' : ''"
              :aria-selected="activeTab === 'settings'"
              @click="setTab('settings')"
            >
              {{ t('iqDetection.tabs.settings') }}
            </button>
          </div>
        </div>
      </header>

      <!-- Settings Tab -->
      <IQDetectionSettingsPanel
        v-if="activeTab === 'settings'"
        :initial-config="overview?.config ?? null"
        @saved="handleConfigSaved"
      />

      <!-- Overview Tab -->
      <template v-else>
        <!-- Summary KPI Cards -->
        <section
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          data-testid="iq-summary-cards"
        >
          <div
            class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700"
          >
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ t('iqDetection.summary.configured') }}
            </div>
            <div
              class="mt-1.5 font-mono text-2xl font-black tabular-nums text-gray-900 dark:text-white"
            >
              {{ overview?.summary.configured_count ?? 0 }}
            </div>
          </div>

          <div
            class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700"
          >
            <div class="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span class="h-2 w-2 rounded-full bg-emerald-500" />
              {{ t('iqDetection.summary.normal') }}
            </div>
            <div
              class="mt-1.5 font-mono text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400"
            >
              {{ overview?.summary.normal_count ?? 0 }}
            </div>
          </div>

          <div
            class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700"
          >
            <div class="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <span class="h-2 w-2 rounded-full bg-amber-500" />
              {{ t('iqDetection.summary.warning') }}
            </div>
            <div
              class="mt-1.5 font-mono text-2xl font-black tabular-nums text-amber-600 dark:text-amber-400"
            >
              {{ overview?.summary.warning_count ?? 0 }}
            </div>
          </div>

          <div
            class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700"
          >
            <div class="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
              <span class="h-2 w-2 rounded-full bg-rose-500" />
              {{ t('iqDetection.summary.degraded') }}
            </div>
            <div
              class="mt-1.5 font-mono text-2xl font-black tabular-nums text-rose-600 dark:text-rose-400"
            >
              {{ overview?.summary.degraded_count ?? 0 }}
            </div>
          </div>

          <div
            class="col-span-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700 sm:col-span-1"
          >
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ t('iqDetection.summary.errorOrUntested') }}
            </div>
            <div
              class="mt-1.5 font-mono text-2xl font-black tabular-nums text-gray-700 dark:text-gray-200"
            >
              {{ (overview?.summary.error_count ?? 0) + (overview?.summary.untested_count ?? 0) }}
            </div>
          </div>
        </section>

        <!-- Configured Groups Real-time Status -->
        <section
          class="card overflow-hidden !rounded-3xl !border-0 shadow-sm ring-1 ring-gray-900/5 dark:!bg-dark-800 dark:ring-dark-700"
        >
          <div class="border-b border-gray-100 px-5 py-4 dark:border-dark-700 sm:px-6">
            <h2 class="text-base font-bold text-gray-900 dark:text-white">
              {{ t('iqDetection.overview.groupsTitle') }}
            </h2>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('iqDetection.overview.groupsSubtitle') }}
            </p>
          </div>

          <div
            v-if="loadingOverview && !overview"
            class="py-12 text-center text-sm text-gray-400"
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
              class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            >
              <Icon name="brain" size="lg" />
            </span>
            <h3 class="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('iqDetection.overview.emptyTitle') }}
            </h3>
            <p class="mt-1 max-w-md text-xs text-gray-500 dark:text-gray-400">
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

          <!-- Configured Groups Table -->
          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-100 text-xs dark:divide-dark-700">
              <thead class="bg-gray-50/80 dark:bg-dark-900/60">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.overview.colGroup') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.overview.colSchedulable') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.overview.colVerdict') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.overview.colAccuracy') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.overview.colReasoning') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.overview.colPerformance') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.overview.colModel') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.overview.colLastTested') }}
                  </th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.overview.colActions') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 bg-white dark:divide-dark-700 dark:bg-dark-800">
                <tr
                  v-for="group in overview.groups"
                  :key="group.group_id"
                  class="transition-colors hover:bg-gray-50/70 dark:hover:bg-dark-700/40"
                >
                  <td class="whitespace-nowrap px-4 py-3.5">
                    <div class="flex items-center gap-2">
                      <span class="font-semibold text-gray-900 dark:text-white">
                        {{ group.group_name }}
                      </span>
                      <span class="font-mono text-[11px] text-gray-400">#{{ group.group_id }}</span>
                      <span
                        class="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        :class="groupStatusBadgeClasses(group.group_status)"
                      >
                        {{ formatGroupStatus(group.group_status) }}
                      </span>
                    </div>
                  </td>

                  <td class="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums text-gray-700 dark:text-gray-300">
                    {{
                      t('iqDetection.overview.schedulableCount', {
                        count: group.schedulable_account_count
                      })
                    }}
                  </td>

                  <td class="whitespace-nowrap px-4 py-3.5">
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

                  <td class="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums">
                    <template v-if="group.latest_run">
                      <span class="font-semibold text-gray-900 dark:text-white">
                        {{ group.latest_run.correct_count }}/{{
                          group.latest_run.graded_count || group.latest_run.tests_count
                        }}
                      </span>
                      <span
                        v-if="group.latest_run.truncated_count > 0"
                        class="ml-1.5 inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      >
                        {{
                          t('iqDetection.overview.truncationHit', {
                            count: group.latest_run.truncated_count
                          })
                        }}
                      </span>
                    </template>
                    <span v-else class="text-gray-400">—</span>
                  </td>

                  <td class="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums text-gray-700 dark:text-gray-200">
                    <template v-if="group.latest_run">
                      <span class="font-semibold text-blue-600 dark:text-blue-400">
                        {{ Math.round(group.latest_run.avg_reasoning_tokens) }}
                      </span>
                      <span class="text-gray-400"> / </span>
                      <span>{{ Math.round(group.latest_run.avg_output_tokens) }}</span>
                    </template>
                    <span v-else class="text-gray-400">—</span>
                  </td>

                  <td class="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums text-gray-700 dark:text-gray-300">
                    <template v-if="group.latest_run">
                      <div>{{ formatLatencyMs(group.latest_run.avg_latency_ms) }}</div>
                      <div class="text-[11px] text-gray-400">
                        {{ formatTps(group.latest_run.avg_tps) }}
                      </div>
                    </template>
                    <span v-else class="text-gray-400">—</span>
                  </td>

                  <td class="whitespace-nowrap px-4 py-3.5 font-mono text-gray-700 dark:text-gray-300">
                    <template v-if="group.latest_run">
                      <span>{{ group.latest_run.response_model || group.latest_run.requested_model || '—' }}</span>
                    </template>
                    <span v-else class="text-gray-400">—</span>
                  </td>

                  <td class="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums text-gray-500 dark:text-gray-400">
                    {{
                      group.latest_run
                        ? formatDateTime(group.latest_run.completed_at)
                        : t('iqDetection.overview.noRecentRun')
                    }}
                  </td>

                  <td class="whitespace-nowrap px-4 py-3.5 text-right">
                    <div class="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
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
                        v-if="group.latest_run"
                        type="button"
                        class="btn btn-secondary btn-sm"
                        :data-testid="`iq-group-detail-${group.group_id}`"
                        @click="openDetail(group.latest_run)"
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
        </section>

        <!-- Detection History -->
        <section
          class="card overflow-hidden !rounded-3xl !border-0 shadow-sm ring-1 ring-gray-900/5 dark:!bg-dark-800 dark:ring-dark-700"
        >
          <div
            class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-dark-700 sm:px-6"
          >
            <div>
              <h2 class="text-base font-bold text-gray-900 dark:text-white">
                {{ t('iqDetection.history.title') }}
              </h2>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {{ t('iqDetection.history.subtitle') }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <select
                v-model.number="historyGroupFilter"
                data-testid="iq-history-group-filter"
                class="input h-9 min-w-[150px] py-1 text-xs"
                @change="onFilterChange"
              >
                <option :value="0">{{ t('iqDetection.history.filterGroupAll') }}</option>
                <option
                  v-for="opt in historyGroupOptions"
                  :key="opt.id"
                  :value="opt.id"
                >
                  {{ opt.name }} (#{{ opt.id }})
                </option>
              </select>

              <select
                v-model="historyVerdictFilter"
                data-testid="iq-history-verdict-filter"
                class="input h-9 min-w-[130px] py-1 text-xs"
                @change="onFilterChange"
              >
                <option value="">{{ t('iqDetection.history.filterVerdictAll') }}</option>
                <option value="normal">{{ t('iqDetection.verdict.normal') }}</option>
                <option value="warning">{{ t('iqDetection.verdict.warning') }}</option>
                <option value="degraded">{{ t('iqDetection.verdict.degraded') }}</option>
                <option value="error">{{ t('iqDetection.verdict.error') }}</option>
              </select>
            </div>
          </div>

          <div
            v-if="loadingHistory && historyRuns.length === 0"
            class="py-12 text-center text-sm text-gray-400"
          >
            <span class="animate-pulse">{{ t('common.loading') }}</span>
          </div>

          <div
            v-else-if="historyRuns.length === 0"
            class="px-6 py-10 text-center"
            data-testid="iq-empty-history"
          >
            <div class="text-sm font-medium text-gray-700 dark:text-gray-200">
              {{ t('iqDetection.history.emptyTitle') }}
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('iqDetection.history.emptyDescription') }}
            </p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-100 text-xs dark:divide-dark-700">
              <thead class="bg-gray-50/80 dark:bg-dark-900/60">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.history.colTime') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.history.colGroup') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.history.colTrigger') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.history.colVerdict') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.history.colAccuracy') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.history.colReasoning') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.history.colLatencyTps') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.history.colModel') }}
                  </th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.history.colPreview') }}
                  </th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                    {{ t('iqDetection.history.colActions') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 bg-white dark:divide-dark-700 dark:bg-dark-800">
                <tr
                  v-for="run in historyRuns"
                  :key="run.id"
                  class="transition-colors hover:bg-gray-50/70 dark:hover:bg-dark-700/40"
                >
                  <td class="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-gray-600 dark:text-gray-300">
                    {{ formatDateTime(run.completed_at) }}
                  </td>

                  <td class="whitespace-nowrap px-4 py-3">
                    <span class="font-medium text-gray-900 dark:text-white">{{ run.group_name }}</span>
                    <span class="ml-1 font-mono text-[11px] text-gray-400">#{{ run.group_id }}</span>
                  </td>

                  <td class="whitespace-nowrap px-4 py-3">
                    <span
                      class="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-dark-700 dark:text-gray-300"
                    >
                      {{ t(`iqDetection.trigger.${run.trigger_type}`) }}
                    </span>
                  </td>

                  <td class="whitespace-nowrap px-4 py-3">
                    <span
                      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      :class="verdictBadgeClasses(run.verdict)"
                    >
                      <span class="h-1.5 w-1.5 rounded-full" :class="verdictDotClasses(run.verdict)" />
                      {{ t(`iqDetection.verdict.${run.verdict}`) }}
                    </span>
                  </td>

                  <td class="whitespace-nowrap px-4 py-3 font-mono tabular-nums">
                    <span class="font-semibold text-gray-900 dark:text-white">
                      {{ run.correct_count }}/{{ run.graded_count || run.tests_count }}
                    </span>
                    <span
                      v-if="run.truncated_count > 0"
                      class="ml-1 rounded bg-amber-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    >
                      {{
                        t('iqDetection.overview.truncationHit', {
                          count: run.truncated_count
                        })
                      }}
                    </span>
                  </td>

                  <td class="whitespace-nowrap px-4 py-3 font-mono font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                    {{ Math.round(run.avg_reasoning_tokens) }}
                  </td>

                  <td class="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-gray-700 dark:text-gray-300">
                    {{ formatLatencyMs(run.avg_latency_ms) }} · {{ formatTps(run.avg_tps) }}
                  </td>

                  <td class="whitespace-nowrap px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                    <span>{{ run.requested_model }}</span>
                    <span
                      v-if="run.response_model && run.response_model !== run.requested_model"
                      class="text-amber-600 dark:text-amber-400"
                    >
                      → {{ run.response_model }}
                    </span>
                  </td>

                  <td class="max-w-xs truncate px-4 py-3 font-mono text-gray-600 dark:text-gray-300">
                    <span v-if="run.error_message" class="text-red-600 dark:text-red-400">
                      {{ run.error_message }}
                    </span>
                    <span v-else>{{ run.answer_preview || '—' }}</span>
                  </td>

                  <td class="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
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

          <Pagination
            v-if="historyTotal > 0"
            :page="historyPage"
            :page-size="historyPageSize"
            :total="historyTotal"
            @update:page="onHistoryPageChange"
            @update:page-size="onHistoryPageSizeChange"
          />
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
  IQDetectionConfig,
  IQDetectionGroupStatus,
  IQDetectionOverview,
  IQDetectionRun,
  IQDetectionVerdict
} from './types'
import {
  type DisplayVerdict,
  formatDateTime,
  formatLatencyMs,
  formatTps,
  resolveConfigIntervalMinutes,
  verdictBadgeClasses,
  verdictDotClasses
} from './verdictMeta'
import IQDetectionSettingsPanel from './IQDetectionSettingsPanel.vue'
import IQDetectionRunDetailDialog from './IQDetectionRunDetailDialog.vue'

type ActiveTab = 'overview' | 'settings'

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
const historyVerdictFilter = ref<IQDetectionVerdict | ''>('')

const detailRun = ref<IQDetectionRun | null>(null)

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

function isGroupRunning(groupId: number, backendInFlight: boolean): boolean {
  return backendInFlight || runningGroupIds.value.has(groupId)
}

function resolveGroupDisplayVerdict(group: IQDetectionGroupStatus): DisplayVerdict {
  if (isGroupRunning(group.group_id, group.in_flight)) {
    return 'inFlight'
  }
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
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'missing':
      return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-300'
  }
}

async function loadOverview(): Promise<void> {
  overviewAbort?.abort()
  const controller = new AbortController()
  overviewAbort = controller
  loadingOverview.value = true
  try {
    overview.value = await getIQDetectionOverview(controller.signal)
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
        verdict: historyVerdictFilter.value || undefined
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
  await reloadAll()
}

async function handleRunAll(): Promise<void> {
  const configuredIds = overview.value?.config.group_ids ?? []
  if (configuredIds.length === 0) {
    appStore.showWarning(t('iqDetection.messages.noGroupsConfigured'))
    setTab('settings')
    return
  }

  runningAll.value = true
  try {
    const res = await runIQDetectionNow({})
    notifyBatchResult(res.executed_groups, res.skipped_in_flight_groups?.length ?? 0)
    await reloadAll()
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t('common.unknownError')))
  } finally {
    runningAll.value = false
  }
}

async function handleRunSingleGroup(groupId: number): Promise<void> {
  const nextSet = new Set(runningGroupIds.value)
  nextSet.add(groupId)
  runningGroupIds.value = nextSet

  try {
    const res = await runIQDetectionNow({ group_ids: [groupId] })
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

onMounted(() => {
  void reloadAll()
})

onUnmounted(() => {
  overviewAbort?.abort()
  historyAbort?.abort()
})
</script>
