---
version: 1
slug: "frontend-src-views-homeview-vue"
primary_target: "frontend/src/views/HomeView.vue"
related_targets: ["frontend/src/components/common/LocaleSwitcher.vue"]
---

# Public Home Surface

Mode: Persuade. Route: `/home` (and `/` redirect).

Audience and task: visitors quickly understand what Sub2API is—one unified API gateway for flagship AI models with multi-account stability and transparent pay-as-you-go control—inspect its three core pillars and supported model ecosystem, and enter `/login` or their dashboard. Also covers the `compact_home_enabled` minimal portal while leaving `home_content` untouched.

Critique reference: `.impeccable/mocks/decision/surface-5-masthead.png` (explicitly simplified by user to a restrained code-led implementation using established UI tokens, omitting the three-step section and comparison table).

## Direction contract

THESIS: Commit Sub2API's deep teal as a calm, full-width upper masthead bridged by an elevated Unified AI Pass panel, replacing the legacy 3D black CLI terminal, blurry blobs, and rainbow SaaS cards with crisp gateway clarity.

OWN-WORLD: Inherit Sub2API's teal brand field (`#0b4f4a`–`#14b8a6`), cool slate `canvas`, pure white and dark semantic `surface` / `surface-2` layers, fine 1px `edge` hairlines, system sans typography, and real `PlatformIcon` vector marks.

STORY: Visitors grasp the site's core introduction in the masthead, inspect connected flagship providers and the three core value pillars inside the Unified AI Pass panel, scan the 8-provider ecosystem matrix, and sign in.

FIRST VIEWPORT: Full-bleed deep-teal upper masthead carrying existing top navigation, centered white headline, clear website introduction copy, and high-contrast white primary action button; an elevated semantic `surface` Unified AI Pass panel straddles the masthead-to-canvas seam with selectable Claude, GPT, Gemini, and Antigravity pills above three 1px-divided core value columns.

FORM: Horizon-bridging Teal Masthead & Unified AI Pass structure (code-led simplified build per user brief), position 5 of 7 on the ordered candidate list, `seed:d01fab949dacce04`. Signature interaction: selecting any model pill on the Unified AI Pass highlights its active routing state and protocol summary with smooth exponential ease-out (`prefers-reduced-motion` safe).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Constraints: zero new backend interactions; no flashy motion, kickers, or gradient text; omit the three-step flow and comparison table; preserve exact header and footer navigation items; preserve `hasHomeContent` verbatim; refresh `compactHomeEnabled` (`data-testid="compact-home"`) in the same Sub2API teal grammar; support `zh`/`en` and light/dark themes; zero invented statistics or trial-credit promises.
