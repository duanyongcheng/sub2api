---
version: 1
slug: "frontend-src-views-admin-dashboardview-vue"
primary_target: "frontend/src/views/admin/DashboardView.vue"
related_targets: ["frontend/src/components/admin/dashboard/AdminLivePulseStrip.vue","frontend/src/components/admin/dashboard/AdminTrafficTrend.vue","frontend/src/components/admin/dashboard/PlatformShare.vue","frontend/src/components/admin/dashboard/TopUsersTrend.vue"]
---

# Admin Operations Dashboard

Mode: Operate. Route: `/admin/dashboard`.

Audience and task: administrators open the dashboard to confirm real-time gateway health (account pool availability across normal/rate-limited/overloaded/error states, live 5-minute RPM/TPM/latency, active users and API keys, and active anomalies) before inspecting selected-period traffic, provider mix, group margin risks, and top-12 user consumption.

Critique reference sketch: `.impeccable/mocks/decision/admin-3band-dense-bar-v2.html`.

## Direction contract

THESIS: Three horizontal temporal strata—Now, Selected Window, and Subordinated Economics—replace the scattered 10-card masonry grid and finance-first opener, putting real-time account pool availability and operational triage ahead of period traffic and billing ledgers.

OWN-WORLD: Inherit Sub2API's established `DESIGN.md` palette (teal `#0d9488`/`#14b8a6` selection, cool slate `canvas`, white/dark `surface` and `surface-2`, 1px `edge` hairlines), system sans typography, tabular numerals, real `PlatformIcon` vector marks, and high-contrast accessible semantic status foregrounds (`emerald-700/300`, `amber-700/300`, `red-700/300`).

STORY: Scan the top live-telemetry band for pool health, 5-minute RPM/TPM/latency, active users/keys, and anomalies; inspect period traffic trend and provider mix in the middle band; audit group gross margins and drill into top-12 heavy users in the lower ledger.

FIRST VIEWPORT: `AppHeader` carries the page title with no duplicate `PageHeader`. Directly below sits a full-width compact live-telemetry strip (6 hairline-divided cells: segmented 4-state account pool availability meter, RPM, TPM, avg latency + cache ratio, active users 1h/today, active API keys) with an attached single-line anomaly triage bar when abnormal accounts, negative/low-margin groups, or stale stats exist. Below it sits a unified period toolbar (Today / 7d / 30d presets, custom `DateRangePicker`, trend series toggle, CSV/XLSX `ReportExportMenu`, refresh) over a 2:1 traffic trend + unified provider-share and quick-entry rail, revealing the start of the unified Economics & Top-12 Users ledger within 1440x900.

FORM: Ultra-compact live telemetry bar + three-band operational ledger (`admin-3band-dense-bar`), position 5 of 6 on reroll round 1, `seed:0cdc65c0594eea32`. Signature interaction: switching the middle band's metric lens (`Requests` / `Tokens` / `Revenue vs Standard`) or the lower ledger's top-user metric (`Spending` / `Tokens`) updates real server series in place with reactive light/dark chart theming, and clicking any account-pool anomaly, risk group, or top user drills directly to the filtered workspace. Motion stays within brief 150ms state transitions with `prefers-reduced-motion` honored.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Constraints: no backend API changes; remove fabricated upstream cost curve (`0.72` ratio) and synthetic cost/margin sparklines; fix `setUserTrendMetric` state update; preserve default 7-day day granularity, `actual_cost` default top-user metric, and 4-sheet CSV/XLSX report export (`data-testid="dashboard-export"`, `report-export-trigger`); preserve simple-mode omissions, stale/unknown vs confirmed zero distinction, `zh`/`en` localization, and light/dark themes. No shipping raster assets are needed.

## Completion
- **Status**: Complete (`disposition: ship` on Verdict Pass after resolving all 8 scored material fixes; 0 regressions).
- **Date**: 2026-11-19
- **Verification**: `vitest` (6 files, 28/28 passed), `vue-tsc -b` (0 errors), `eslint` (0 errors), `vite build` (clean), `impeccable detect --json --changed` (`[]`), Playwright synthetic verification (`42/42` assertions across `admin-desktop.png`, `admin-narrow.png`, `admin-dark.png`, `admin-mobile.png`).
- **DESIGN.md Alignment**: Confirmed ordinary extension inside Sub2API's established `DESIGN.md` visual world (`--canvas`, `--surface`, `--surface-2`, `--surface-3`, `--edge`, `--edge-strong`, `--ink*`, teal primary `#0d9488`/`#14b8a6`, tabular numerals, light/dark parity including migrated `DateRangePicker`). `DESIGN.md` and `.impeccable/design.json` preserved without unasked edits.
- **Review Record**: `.trellis/tasks/11-19-dashboard-redesign/research/finish-review.md`.
