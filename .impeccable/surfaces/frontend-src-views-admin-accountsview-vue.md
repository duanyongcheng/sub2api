---
version: 1
slug: "frontend-src-views-admin-accountsview-vue"
primary_target: "frontend/src/views/admin/AccountsView.vue"
related_targets: ["frontend/src/components/admin/account/AccountPoolNavigator.vue","frontend/src/components/admin/account/AccountPoolOverview.vue"]
---

# Accounts workspace

Mode: Operate. Route: `/admin/accounts`.

Audience and task: administrators select an account pool, inspect usable capacity and quota, then investigate or change accounts. Existing provider actions and bulk scope must remain clear.

## Direction contract

THESIS: A pool directory and a compact account workspace let operators narrow scope before interpreting numbers. Replace the scattered full-width summary and filter wall with one connected work area.

OWN-WORLD: Inherit Sub2API's teal selection color, cool canvas, white surfaces, fine semantic borders, system sans typography and tabular figures. State color only marks availability, pressure or failure.

STORY: Choose a group or platform, read scope and capacity, scan account health and quota, then open details or act. Group totals and page totals explicitly retain their distinct scopes.

FIRST VIEWPORT: Existing app shell carries the page title; the workspace begins directly below it. A roughly 216px searchable pool directory sits left of a flexible area containing scope heading, matching count, Import and Add Account actions, low-height metrics, search/status/filter controls and an aligned dense table. Refresh and secondary tools stay in the filter toolbar. Desktop panes fill the shared height below the shell and page gutters. Mobile collapses pool navigation into a disclosure, wraps the two primary actions below the scope heading, and uses existing account cards.

FORM: Previously approved pool-first master/detail structure, pinned in the repository's user decision record; the new implementation is fresh. Seed consulted: seed:1311c0c08607f115; the pinned structure takes precedence over the dealt alternatives. Signature interaction: selecting a pool synchronizes the selected navigation row, scope metrics and server-filtered table without losing saved sorting/columns. Motion uses brief color/opacity transitions with reduced-motion support.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Constraints: no backend changes, no synthetic production metrics, all existing row/provider/bulk actions reachable, simple mode skips unsupported summaries, summary failures do not block accounts. No shipping raster assets are needed.

## Completion

Implemented and inspected at 1440px, 1280px and390px, including dark mode and interactive states. Final review scored both material fixes (provider-note containment and sampled operational-text contrast) resolved, disposition `ship`; this verdict is limited to the scored findings. Root `DESIGN.md` and `.impeccable/design.json` document the observed system. No shipping raster assets require provenance. Review evidence: `.trellis/tasks/11-11-accounts-workspace-redesign/research/finish-verdict.md` and `.impeccable/review/`.
