---
version: 1
slug: "detection-user-iqdetectionpublicview-vue-c8b23f2c"
primary_target: "frontend/src/features/iq-detection/user/IQDetectionPublicView.vue"
related_targets: ["frontend/src/features/iq-detection/user/IQDetectionPublicGroupSheet.vue","frontend/src/features/iq-detection/user/IQDetectionPublicGallery.vue"]
---

# User IQ Detection (read-only)

Mode: Operate/Read. Route: `/iq-detection` (`UserIQDetection`).

Audience and task: authenticated end users check whether the OpenAI/Codex groups they can use are currently answering at normal reasoning quality, how that has moved over recent checks, and what the latest Pelican artwork looks like. They only look: no run, settings or benchmark controls. Hidden: accounts, error text, tokens, raw answers, response model.

States: loading skeleton, disabled (`IQ_DETECTION_NOT_PUBLIC` → calm not-available panel; sidebar entry hidden), error strip with retry, empty (no visible groups), per-benchmark "not checked yet", per-row trend failure.

## Direction contract

THESIS: A per-group verdict ledger, read like a status page, not a dashboard: no hero metrics, no KPI tiles. Each group is one ruled sheet whose rows are benchmarks.

OWN-WORLD: Sub2API's DESIGN.md world unchanged: cool canvas, white/dark surface sheets with 1px edge hairlines, surface-2 headers, teal only for focus/selection, semantic emerald/amber/rose/red verdict foregrounds from verdictMeta.ts, system sans, tabular figures.

STORY: Understand what is measured and how often (methodology sheet), see each group's current health and per-benchmark latest result with last-checked time, read the recent run history as a verdict strip, then look at the artwork.

FIRST VIEWPORT: AppHeader title (mobile in-page heading). A methodology sheet: one plain sentence, a metadata line (model · effort · cadence · last scheduled check) and two benchmark definitions side by side. Below, group sheets: header row with name, platform and health pill; one row per benchmark with verdict, score, checked-ago, and a 24-slot verdict strip (bar height = score). No primary action exists.

FORM: Ruled ledger sheets + verdict strip + sandboxed gallery. seed: none (pinned) — "Show summary + trend + Pelican SVG artwork"; "Mode: Operate/Read — precision and restraint, not marketing."

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
