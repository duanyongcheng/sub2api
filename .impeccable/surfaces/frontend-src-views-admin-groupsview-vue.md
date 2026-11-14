---
version: 1
slug: "frontend-src-views-admin-groupsview-vue"
primary_target: "frontend/src/views/admin/GroupsView.vue"
related_targets: ["frontend/src/components/admin/group/GroupDirectory.vue","frontend/src/components/admin/group/GroupOverview.vue"]
---

# Groups workspace

Mode: Operate. Route: `/admin/groups`.

Audience and task: administrators choose a group, read its identity and today's economics, then move across pricing, routing, model, subscription and scheduling configuration without leaving the page. All existing row actions, unsaved-change protection and simple-mode omissions remain reachable.

## Direction contract

THESIS: A group is a product unit: price, routing and capacity in one object. Replace the stacked list card, summary card and titled editor card with one directory and one continuous configuration sheet; the sheet's identity and economics are its header, not a separate dashboard card.

OWN-WORLD: Inherit Sub2API's teal selection colour, cool canvas, white surfaces, fine semantic borders, system sans typography and tabular figures. Status colour only marks active/inactive, subscription type, exclusivity and margin pressure; platform colour stays in the platform mark.

STORY: Scan the directory, choose a group, read its status, multiplier and today's revenue/cost/margin/accounts, then work through its configuration areas; unsaved changes stay visible and switching groups is guarded.

FIRST VIEWPORT: Existing app shell whose top bar carries the page title; catalogue actions live with their surface. The directory header holds refresh, the workspace/table switch, sort and create; the table view repeats those actions in its filter bar. A 288px directory sits left of a flexible sheet. The directory carries a search field, one platform select and a three-way status control above the rows. The sheet opens with a 40px platform mark, name, status/type pills, multiplier chip, description and quiet actions; a four-cell metrics strip follows; the configuration tab rail is the sheet's own top edge, with the close control and unsaved pill at its right. The save bar is anchored at the sheet's bottom.

FORM: Master/detail. Signature interaction: selecting a group updates the sheet, metrics and tab content in place; the directory row stays visible; unsaved changes mark the rail and guard selection. On mobile the directory collapses to a single disclosure showing the current group; the sheet stays in the first viewport. Motion is brief colour/opacity only and reduced-motion is honoured.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Constraints: no backend or API changes; all configuration fields, create/edit/save/reset/close, duplicate, rate multiplier, RPM override, delete, sorting, column settings and simple-mode omissions stay reachable. Group totals remain page-scoped. No shipping raster assets are needed.

## Completion

Implemented and inspected at 1600px, 1280px and 390px, including dark mode and the table, create and unsaved states. Finish review disposition `ship`; no material fixes. Evidence: `.trellis/tasks/11-12-groups-workspace-redesign/research/finish-review.md` and `.impeccable/review/groups/`. No shipping raster assets.

Follow-up: desktop directory and detail now share a viewport-height boundary with internal scrolling, and the workspace catalogue loads every matching group without pagination. Verified over 1,205 synthetic groups at 1600/1280/dark/390, including create mode, long tabs and table round-trips. Evidence: `.trellis/tasks/11-12-groups-workspace-redesign/research/followup-browser-report.json` and `.impeccable/review/groups/followup-*.png`.
