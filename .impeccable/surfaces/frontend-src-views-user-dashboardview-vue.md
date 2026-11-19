---
version: 1
slug: "frontend-src-views-user-dashboardview-vue"
primary_target: "frontend/src/views/user/DashboardView.vue"
related_targets: ["frontend/src/components/user/workbench/WorkbenchReadinessLedger.vue","frontend/src/components/user/workbench/WorkbenchTrend.vue","frontend/src/components/user/workbench/WorkbenchRecentRequests.vue"]
---

# User Developer Workbench

Mode: Operate. Route: `/dashboard`.

Audience and task: authenticated end users open their workbench to immediately verify whether they can call the gateway right now (wallet balance, subscription headroom, active API keys, live concurrency/RPM, and recent request errors), then inspect period usage trends, per-platform consumption and quotas, top models, and recent requests or errors.

Critique reference sketch: `.impeccable/mocks/decision/user-console-feed.html`.

## Direction contract

THESIS: A single-column full-width developer console feed replaces the radial-gradient greeting banner, nested quota boxes, and mismatched two-column card stack with one continuous readiness ledger, a full-width trend + platform/model deck, and a wide request/error log inspector.

OWN-WORLD: Inherit Sub2API's established `DESIGN.md` palette (teal `#0d9488`/`#14b8a6` selection and primary button, cool slate `canvas`, white/dark `surface` and `surface-2`, 1px `edge` hairlines), system sans typography, tabular numerals, real `PlatformIcon` vector marks, and accessible semantic status foregrounds (`emerald-700/300`, `amber-700/300`, `red-700/300`).

STORY: Confirm readiness across balance, active subscription windows, API keys, concurrency/RPM, and any recent request errors; read period consumption trends alongside per-platform quotas and top models; audit recent completed or failed calls and jump directly to `/keys`, `/usage`, `/redeem`, or `/monitor`.

FIRST VIEWPORT: `AppHeader` carries the page title with no duplicate `PageHeader` and no greeting banner. Directly below sits a slim control bar (Today / 7d / 30d presets, custom `DateRangePicker`, refresh, quick links to Channel Status / Redeem / Batch Image when enabled, and primary Create API Key CTA) above a full-width hairline-divided readiness ledger (Available Balance + frozen badge, Subscription Quota progress, Active API Keys, Live RPM/TPM & Concurrency, Today Actual vs Standard Spend + real saving %; collapsing cleanly to 3 equal non-billing cells in simple mode). When recent errors exist in the active range, a single red hairline alert strip attaches beneath with a jump to the Errors tab. Next sits a full-width Usage Trend sheet (`Requests` / `Tokens` / `Cost`, `Day` / `Hour`, accurate summary metrics) joined above a 2-column Platform Quotas & Top Models shelf, followed by the full-width Recent Requests / Recent Errors tabbed table.

FORM: Single-column developer console feed (`user-console-feed`), position 6 of 6 on the candidate list, `seed:b074fc9d1769a24e`. Signature interaction: changing the date range synchronizes the usage trend, top models, recent requests (`page_size: 8`), and recent error count/list together; toggling between `Recent Requests` and `Error Requests` switches the bottom table in place with direct links into `/usage`. Motion stays within brief 150ms transitions with `prefers-reduced-motion` honored.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Constraints: no backend API changes; remove fake wallet 100% progress bar, fake token/request duration sparkline, empty P95 slot, and broken `share >= 60% -> Today` pill; include platforms with configured quotas even at 0 requests today; reactive light/dark chart theming; clean simple-mode omission without blank grid holes; `zh`/`en` localization and light/dark themes. No shipping raster assets are needed.

## Completion
- **Status**: Complete (`disposition: ship` on Verdict Pass after resolving all 8 scored material fixes; 0 regressions).
- **Date**: 2026-11-19
- **Verification**: `vitest` (6 files, 28/28 passed), `vue-tsc -b` (0 errors), `eslint` (0 errors), `vite build` (clean), `impeccable detect --json --changed` (`[]`), Playwright synthetic verification (`42/42` assertions across `user-desktop.png`, `user-narrow.png`, `user-dark.png`, `user-mobile.png`, `user-errors-tab.png`, `user-simple.png`).
- **DESIGN.md Alignment**: Confirmed ordinary extension inside Sub2API's established `DESIGN.md` visual world (`--canvas`, `--surface`, `--surface-2`, `--surface-3`, `--edge`, `--edge-strong`, `--ink*`, teal primary `#0d9488`/`#14b8a6`, tabular numerals, light/dark parity including migrated `DateRangePicker`). `DESIGN.md` and `.impeccable/design.json` preserved without unasked edits.
- **Review Record**: `.trellis/tasks/11-19-dashboard-redesign/research/finish-review.md`.
