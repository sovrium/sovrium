/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the disclosure components.
 *
 * Schema authors who write the bare `{ type: 'tabs', children: [{ type:
 * 'tab-panel', ... }] }` or `{ type: 'accordion', children: [...] }` get a
 * complete, opinionated reveal-control — bordered tab strip with primary-tone
 * underline indicator on the active tab, rounded accordion shell with a
 * divider between items, and a chevron icon that rotates 180deg when the
 * panel opens — with zero theme-layer dependency.
 *
 * The recipe mirrors the buttons + inputs + selects + toggles + numeric +
 * date + overlays slices (commits 02b2f35f3 + 571ae53ce + 5527660bc +
 * 000f835d7 + 386e9dc35 + 3d35fad9a + 0de6ded2a): layout / spacing classes
 * (`flex`, `px-4 py-2`, `gap-2`), animation classes
 * (`transition-colors duration-200`, `data-[open]:rotate-180`), and data-
 * state selectors (`data-[active]`, `data-[open]`, `data-[disabled]`) stay
 * as raw Tailwind utilities — they encode behavior, not color — while every
 * color / border / radius / shadow class goes through {@link withVarFallback}
 * so `app.design.*` overrides still win at the CSS cascade layer
 * (`var(--sv-X)` resolves the override first, falling back to the inline
 * OKLCH literal).
 *
 * ONE DELIBERATE EXCEPTION to that rule: the classes behind a BRACKETED
 * variant (`data-[active]:…`) use the canonical role utilities
 * (`text-primary`, `border-primary`, `bg-background-subtle`) rather than a
 * `var(--sv-…)` arbitrary value. The safelist generator that keeps
 * template-built arbitrary classes in the compiled stylesheet
 * (`src/infrastructure/css/arbitrary-var-safelist.ts`) matches only a plain
 * variant chain (`hover:`, `focus-visible:`) — a bracketed variant does not
 * parse, so `data-[active]:text-[var(--sv-primary,…)]` would be silently
 * dropped and would paint nothing while looking correct in source. The role
 * utilities are literal class names, so Tailwind scans them directly, and
 * they still follow an author `theme.colors.primary` override through
 * `--color-primary`.
 *
 * Subparts covered (matches the existing DOM layering across the two
 * disclosure islands: `tabs-island.tsx`, `accordion-island.tsx`):
 *
 *   - TABS ROOT       — outer `<Tabs.Root>` wrapper; carries the layout for a
 *                       `vertical` tab set, where the trigger column sits
 *                       beside the panel rather than above it
 *   - TABS LIST       — outer `<Tabs.List>` strip with bottom (or right)
 *                       border separating triggers from the active panel
 *   - TAB             — single `<Tabs.Tab>` trigger button; state axis
 *                       `default | active | disabled` flips the accent edge
 *                       and foreground tone
 *   - TAB LABEL       — the caption line inside a trigger that also carries a
 *                       description
 *   - TAB DESCRIPTION — the optional second line beneath that caption
 *   - TAB INDICATOR   — animated `<Tabs.Indicator>` underline that slides
 *                       under the selected tab
 *   - TAB PANEL       — `<Tabs.Panel>` content region below the strip
 *   - ACCORDION ROOT  — outer `<Accordion.Root>` shell with rounded border
 *                       and per-item dividers
 *   - ACCORDION TRIGGER — header `<Accordion.Trigger>` row; state axis
 *                       `default | open | disabled` brightens the surface
 *                       on open / hover
 *   - ACCORDION ICON  — chevron `<svg>` inside the trigger that rotates
 *                       180deg via `data-[open]:rotate-180`
 *   - ACCORDION PANEL — `<Accordion.Panel>` collapsible content region
 *                       below an opened trigger
 *
 * Helper file lives in `src/presentation/islands/` (alongside the islands
 * that consume it) because both disclosure islands hydrate entirely client-
 * side via the island registry — the `presentation-component →
 * presentation-island` layer boundary disallows island imports from
 * `ui/sections/`. Mirrors the location chosen for `select-default-classes.ts`,
 * `toggle-default-classes.ts`, `numeric-default-classes.ts`,
 * `date-default-classes.ts`, and `overlay-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

type TriggerState = 'default' | 'open' | 'disabled'

// `radius-md` (6px) is the shared surface radius every other shell settled on
// in R-D — the list, table, gallery, chart and kpi shells all spend it, and the
// canvas draws the accordion frame at 6px in all three of its variant drawings.
// The accordion kept `radius-lg` (8px) only because it converged in a different
// wave; at V it was the last shell out of step. `gallery-default-classes.ts`
// records the same drop for the same reason.
const RADIUS_MD = `rounded-[${v('radius-md', T.radiusMd)}]`

export const DISABLED_INLINE = 'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'

// ──────────────────────────────────────────────────────────────────────────────
// ACCORDION ROOT (outer shell with rounded border + per-item dividers)
// ──────────────────────────────────────────────────────────────────────────────

const ACCORDION_ROOT_LAYOUT = 'border'

const ACCORDION_ROOT_SURFACE = [
  `border-[${v('sv-border', T.border)}]`,
  // `divide-y` adds a 1px horizontal line BETWEEN sibling items via the
  // border-color of subsequent elements; we tint that color so the
  // dividers match the outer border.
  'divide-y',
  `divide-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for the outer `<Accordion.Root>` shell.
 * `radius-md` corners + bordered surface so the accordion reads as one
 * cohesive card; the `divide-y` rule adds 1px dividers between items so
 * each header/panel pair feels grouped without the heaviness of an outer
 * border per item.
 */
export const computeAccordionRootClasses = (): string =>
  [ACCORDION_ROOT_LAYOUT, RADIUS_MD, ACCORDION_ROOT_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ACCORDION TRIGGER (header row that toggles the panel)
// ──────────────────────────────────────────────────────────────────────────────

// `group` is load-bearing rather than decorative: it is what lets the chevron
// below read the trigger's open state. Base UI stamps `data-panel-open` on the
// TRIGGER and `data-open` on the HEADER, so the icon — which is given neither —
// can only see the state through an ancestor marker.
const ACCORDION_TRIGGER_LAYOUT =
  'group flex w-full items-center justify-between px-4 py-3 text-left text-base font-medium transition-colors'

const ACCORDION_TRIGGER_SURFACE = [
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  // Open trigger keeps its bg-subtle so the active section reads as
  // distinct from collapsed siblings even when the cursor moves away.
  `data-[open]:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * Compute the default className for the `<Accordion.Trigger>` header row.
 * The `state` axis is reserved for forward compatibility — Base UI exposes
 * the open state via `data-[open]` and disabled via `data-[disabled]`
 * directly, so the recipe paints all three branches without an explicit
 * branch at call time. Strong foreground tone + medium weight so the
 * header anchors the section; bg-subtle highlight on hover OR when the
 * panel is open signals which row is interactive vs collapsed.
 */
export const computeAccordionTriggerClasses = ({
  state: _state = 'default',
}: {
  state?: TriggerState
} = {}): string => [ACCORDION_TRIGGER_LAYOUT, ACCORDION_TRIGGER_SURFACE, DISABLED_INLINE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ACCORDION ICON (chevron rotating on open)
// ──────────────────────────────────────────────────────────────────────────────

const ACCORDION_ICON_LAYOUT =
  'shrink-0 transition-transform duration-200 group-data-[panel-open]:rotate-180'

const ACCORDION_ICON_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for the chevron `<svg>` inside an
 * accordion trigger. The chevron rotates 180deg when its section opens, read
 * off the enclosing `group` trigger's `data-panel-open`; Tailwind handles the
 * animation with `transition-transform duration-200`. Muted foreground tone
 * (`sv-fg-muted`) so the icon reads as an affordance hint rather than as a
 * focal element competing with the header text.
 *
 * The variant has to reach through the trigger because Base UI gives the
 * `<svg>` no state of its own: `data-open` lands on `<Accordion.Header>` and
 * `data-panel-open` on `<Accordion.Trigger>`. A bare `data-[open]:rotate-180`
 * on the icon therefore matched nothing and the chevron never turned
 *. This is the spelling the nav-menu chevron already
 * uses for the same reason — see `group-data-[popup-open]` in
 * `nav-menu-parts.tsx`.
 */
export const computeAccordionIconClasses = (): string =>
  [ACCORDION_ICON_LAYOUT, ACCORDION_ICON_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ACCORDION PANEL (collapsible content region)
// ──────────────────────────────────────────────────────────────────────────────

const ACCORDION_PANEL_LAYOUT = 'overflow-hidden px-4 pb-3 text-md'

const ACCORDION_PANEL_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for the `<Accordion.Panel>` content region
 * — the collapsible body that Base UI shows when its sibling trigger is
 * open. Muted foreground tone since the panel content is supporting detail
 * (the header is the focal label); `overflow-hidden` ensures the Base UI
 * height animation doesn't leak content during the open/close transition.
 */
export const computeAccordionPanelClasses = (): string =>
  [ACCORDION_PANEL_LAYOUT, ACCORDION_PANEL_SURFACE].join(' ')
