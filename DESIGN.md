---
name: Sub2API Admin
description: Established teal administration interface with cool neutral surfaces and precise operational data.
colors:
  primary-500: "#14b8a6"
  primary-600: "#0d9488"
  primary-50: "rgb(240 253 250)"
  primary-700: "rgb(15 118 110)"
  primary-50-dark: "rgb(10 46 42)"
  primary-700-dark: "rgb(94 234 212)"
  canvas: "rgb(246 248 250)"
  canvas-dark: "rgb(7 11 18)"
  surface: "rgb(255 255 255)"
  surface-dark: "rgb(13 20 32)"
  surface-2: "rgb(251 252 253)"
  surface-2-dark: "rgb(17 26 40)"
  surface-3: "rgb(241 245 249)"
  surface-3-dark: "rgb(22 32 47)"
  edge: "rgb(232 237 242)"
  edge-dark: "rgb(29 40 56)"
  edge-strong: "rgb(217 225 234)"
  edge-strong-dark: "rgb(42 55 74)"
  ink: "rgb(15 23 42)"
  ink-dark: "rgb(232 238 246)"
  ink-2: "rgb(71 85 105)"
  ink-2-dark: "rgb(164 178 197)"
  ink-3: "rgb(138 151 168)"
  ink-3-dark: "rgb(107 123 144)"
  white: "#ffffff"
typography:
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, "Segoe UI", system-ui, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "21px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, "Segoe UI", system-ui, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, "Segoe UI", system-ui, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "19px"
  data:
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, "Segoe UI", system-ui, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "12.4px"
    fontWeight: 400
    lineHeight: "18px"
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, "Segoe UI", system-ui, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: "16px"
  button:
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, "Segoe UI", system-ui, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "13.5px"
    fontWeight: 600
rounded:
  lg: "8px"
  field: "10px"
  card: "14px"
  shell: "18px"
  full: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "3.5": "14px"
  "4": "16px"
  card-body: "18px"
  "5": "20px"
  "6": "24px"
components:
  button-primary:
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  button-ghost:
    textColor: "{colors.ink-2}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "8px 14px"
    width: "100%"
  navigation-selected:
    backgroundColor: "{colors.primary-50}"
    textColor: "{colors.primary-700}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "34px"
  chip:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.lg}"
    padding: "2px 8px"
  pill-brand:
    backgroundColor: "{colors.primary-50}"
    textColor: "{colors.primary-700}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
---

# Design System: Sub2API Admin

## Overview

Sub2API's administration interface uses teal for selection and primary actions, a cool neutral canvas, and lightly bordered surfaces. The existing system sans stack supports Chinese and English operational copy. Hierarchy comes from spacing, text weight, alignment and tabular figures.

This record captures the implemented shared theme. Sources are [the global stylesheet](frontend/src/style.css), [Tailwind configuration](frontend/tailwind.config.js), the authenticated layout and shared primitives. The reviewed accounts workspace provides a current application of that system. Its composition and operating mode remain in [its surface brief](.impeccable/surfaces/frontend-src-views-admin-accountsview-vue.md); the pool directory is a page pattern, not a required layout for every screen.

**Key Characteristics:**

- Teal interaction cues over cool neutral light and dark themes.
- Compact system typography with a clear distinction between names, labels and numeric values.
- Fine borders, modest corner rounding and restrained elevation.
- Existing shared controls with explicit selected, loading, unavailable and error states.

## Colors

The palette combines a teal interaction accent with slate-tinted neutrals; semantic status colors retain their operational meaning.

### Primary

`primary-500` is the bright teal used in tracks, focus rings and primary-action gradients; `primary-600` is the deeper gradient endpoint. Selected navigation uses the quiet `primary-50` tint and the readable `primary-700` foreground. The latter pair changes with the theme.

### Neutral

`canvas` supplies the page ground. `surface` holds cards, tables, controls and dialogs; `surface-2` distinguishes headers and hover surfaces; `surface-3` supplies inset tracks and metadata backgrounds. `edge` separates regions and `edge-strong` outlines controls. `ink` carries primary text, `ink-2` supporting operational text and `ink-3` lower-emphasis content.

The frontmatter records the actual light values and their observed `-dark` counterparts. Those documentation suffixes identify theme variants; application code uses the same unsuffixed CSS variable in both themes. Values in `style.css` are raw RGB triplets: use `rgb(var(--surface))` or `rgb(var(--surface) / 0.8)`. The application switches the variables under `.dark`. Fixed primary ramp stops are defined in Tailwind, so there is no `--primary-500` or `--primary-600` variable to reference.

### Semantic states and account contrast

Success, warning and error are separate from the interaction accent. The global stylesheet includes the existing `ok`, `warn`, `bad`, `info` and `violet` semantic families alongside legacy badge utilities. Their presence does not certify every legacy color pairing for small text.

The accounts workspace opts into stronger foregrounds through `AccountStatusIndicator` and `AccountTodayStatsCell` (`accessibleContrast`) and page-scoped usage styles: emerald (`#047857` light / `#6ee7b7` dark), amber (`#b45309` / `#fcd34d`) and red (`#b91c1c` / `#fca5a5`). These are the existing Tailwind 700/300 foregrounds used by this page, not newly declared global tokens. Supporting account amounts and reset information use `ink-2`; provider quota fills retain their existing colors.

**The Theme Pairing Rule.** Resolve neutral surfaces, borders and text through their semantic variables so they change together between themes. Recheck small operational text on its actual background, including hover states.

## Typography

The sans stack and observed roles are recorded in the frontmatter. The first available system family renders the interface; the presence of Inter in the fallback stack does not imply a separately loaded brand face. Monospace uses the existing `ui-monospace`, `SF Mono`, `SFMono-Regular`, `JetBrains Mono`, `Menlo`, `Consolas`, `monospace` stack for identifiers and technical metadata.

The shared page headline is bold with slightly tightened spacing. Section titles use semibold text; body and table roles stay compact. The configured ladder also includes micro text (`10.5px / 14px`) and very small labels (`10px / 13px`). These are implementation observations, not a reason to shrink new operational content. There is no separate display-face treatment to reproduce.

Component roles can differ from the general ladder: the accounts scope heading uses semibold text (`16px / 24px`), group metrics use semibold text (`20px / 28px`), and today amounts use semibold text (`12.5px`) with supporting figures (`10.5px`). Amounts, quotas and counts use tabular figures. Quota descriptions wrap within their column rather than reducing the type size to fit.

## Layout

The authenticated shell has an expanded sidebar (`248px`), a collapsed sidebar (`72px`) and top bar (`64px`). `AppLayout` applies the sidebar offset from the large breakpoint (`1024px`), with main horizontal gutters of (`16px`) increasing to (`24px`) from the medium breakpoint (`768px`). Main top padding is (`20px`). Current authenticated content fills the available width; the configured `content` maximum (`1400px`) is not applied by this layout.

Spacing largely follows the existing four-pixel rhythm with half steps for compact controls. Standard card bodies use the observed intermediate padding recorded in `spacing.card-body`. Controls and actions wrap when space runs short. Default Tailwind breakpoints remain small (`640px`), medium (`768px`), large (`1024px`), extra large (`1280px`) and double extra large (`1536px`).

Page-specific widths, table density, pool navigation collapse, saved column handling and server-sort behavior belong to the [accounts surface contract](.impeccable/surfaces/frontend-src-views-admin-accountsview-vue.md) and its [implementation](frontend/src/views/admin/AccountsView.vue), not to this global spatial model. The reviewed desktop, mobile, dark and narrow captures live in `.impeccable/review/` and show synthetic examples.

## Elevation & Depth

The system combines tonal layers, fine borders and small shadows. Shared cards and secondary buttons use the configured `shadow-xs`. Primary buttons add a subtle white inner highlight and a teal shadow. Floating menus and drawers use stronger shadows so they separate from the surface below. The top bar uses a translucent surface and backdrop blur. This material treatment is already present in the shared shell. The stylesheet also declares a theme-aware `--elevation-xs`, but the sampled card and button classes resolve through Tailwind's literal shadow configuration; this record does not treat that declaration as their active binding.

The sidecar records the exact observed shadow values and motion timings. Shared controls commonly transition colors or field borders over (`150ms`); dialogs enter over (`250ms`) and leave over (`200ms`). Modal transitions reduce to (`1ms`) with transforms removed under reduced-motion preferences. The account pool navigation also disables its color transition under reduced motion; this does not establish reduced-motion coverage for every legacy component.

**The Local Depth Rule.** Use the existing small shadow for ordinary containers and the existing elevated treatment for overlays. Preserve page-scoped flat table treatments where implemented.

## Shapes

Controls have gently curved corners (`rounded.field`); standard cards and shell containers use progressively larger radii (`rounded.card`, `rounded.shell`). Compact metadata chips and shared sidebar links use the smaller `rounded.lg`. Status pills and progress tracks use full rounding. Borders are generally a single pixel and follow the semantic edge color.

These named radii are reusable vocabulary, not a claim that every older component has migrated. The account page deliberately uses the control radius for its directory and table container. Drawers attach to the screen edge and use square outer corners. Preserve those component-specific shapes when extending an existing surface.

## Components

### Buttons

Shared buttons use the frontmatter's semibold button role, control radius, regular height and horizontal padding. Primary actions use the existing vertical teal gradient, white text, inner highlight and teal shadow; the gradient is carried in the sidecar because the component token schema has no background-image property. Hover raises brightness (`1.06`); active presses scale to (`0.985`).

Secondary actions use a strong edge, semantic surface and supporting ink, with a quieter raised surface on hover. Ghost actions use supporting ink and reveal the inset background on hover. Shared focus uses a teal ring with a surface-colored offset; disabled buttons reduce opacity (`0.45`). Small buttons use a lower height (`32px`), smaller radius (`8px`) and compact padding; icon buttons retain their own sizing. The accounts row and mobile action sizes are local adaptations.

### Inputs / Fields

Inputs use the semantic surface, strong edge, body typography and control radius, with the frontmatter's padding. Focus changes the border to bright teal and adds a translucent teal ring (`3px`). Disabled fields use the inset surface and lower-emphasis ink. Error fields use the existing red border and ring. Labels are semibold (`12.5px`); validation messages remain separate from placeholders.

### Navigation

The shared sidebar uses compact rows (`34px`), the smaller radius (`8px`) and medium-weight text (`13.2px`). Hover reveals the inset surface; the active row uses the theme-dependent teal tint and foreground with semibold text. Shell navigation collapses through the existing layout behavior. The accounts pool directory has its own disclosure, selected-scope state and keyboard behavior, described by its surface brief.

### Chips and pills

Metadata chips use an inset neutral surface, supporting ink, semibold text (`12px / 16px`) and compact padding. Rounded status pills use a smaller semibold label role and may carry a small dot. The brand pill represents a teal state. Filter-removal controls are actual buttons with accessible labels, hover treatment and enough height for their page context; static metadata chips remain noninteractive.

### Cards / Containers

Standard cards combine the card radius, semantic surface, a fine edge and the configured small shadow. Headers and footers separate content with a line; card bodies use the recorded padding. Interactive hover elevation is an opt-in card variant. The accounts overview uses a low bordered region inside its workspace rather than a grid of independent cards.

### Tables and detail presentation

Reuse `DataTable` for table/card responsiveness and existing account cells for provider-aware quota, capacity and status. The account page's compact concurrency presentation and stronger status/today contrast are opt-in. The detail drawer keeps the full capacity presentation and accepts already loaded today figures; it is not a new automatic usage-fetch surface. Restore-defaults and saved server-sort handling are account behavior, not global styling tokens.

**The Value Integrity Rule.** Keep numeric values with their labels and units. Loading, unavailable, stale and confirmed zero remain visually distinguishable, and complete provider explanations stay contained without covering neighboring data.

The [final review verdict](.trellis/tasks/11-11-accounts-workspace-redesign/research/finish-verdict.md) reports the two material fixes resolved: quota-note containment and sampled operational-text contrast. It is a ship verdict for those findings. It does not establish a full accessibility audit of the application or every drawer element.

## Do's and Don'ts

### Do:

- **Do** use the existing semantic surface, edge and ink variables for new theme-aware UI.
- **Do** reserve the teal interaction treatment for selection, focus and primary actions while preserving semantic status meanings.
- **Do** use tabular figures and readable foregrounds for operational amounts, limits and counts.
- **Do** preserve wrapping, disclosure space and visible keyboard focus in compact components.
- **Do** consult the matching surface brief before copying a page composition or changing its responsive behavior.

### Don't:

- **Don't** treat optional account contrast styles or compact table density as a global theme migration.
- **Don't** turn missing values or failed requests into a displayed zero.
- **Don't** let quota explanations or expanded actions cover adjacent cells.
- **Don't** infer a new display font, named brand metaphor or decorative asset requirement from this descriptive record.
- **Don't** treat sampled contrast checks or the bounded ship verdict as complete accessibility certification.
