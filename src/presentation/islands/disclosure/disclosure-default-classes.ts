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
import { FOCUS_VISIBLE_RING } from '@/presentation/design/shared-tokens-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

type TabsOrientation = 'horizontal' | 'vertical'
type TabState = 'default' | 'active' | 'disabled'
type TriggerState = 'default' | 'open' | 'disabled'

// `radius-md` (6px) is the shared surface radius every other shell settled on
// in R-D — the list, table, gallery, chart and kpi shells all spend it, and the
// canvas draws the accordion frame at 6px in all three of its variant drawings.
// The accordion kept `radius-lg` (8px) only because it converged in a different
// wave; at V it was the last shell out of step. `gallery-default-classes.ts`
// records the same drop for the same reason.
const RADIUS_MD = `rounded-[${v('radius-md', T.radiusMd)}]`

const DISABLED_INLINE = 'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'

// ──────────────────────────────────────────────────────────────────────────────
// TABS ROOT (outer wrapper — the layout axis for a vertical tab set)
// ──────────────────────────────────────────────────────────────────────────────

// A vertical tab set puts its trigger column BESIDE the panel — that is what
// `vertical` means to an author who reaches for it. Below `md` the column
// stacks back above the panel on purpose: a trigger that carries a second line
// cannot read in a narrow side column, and the panel it would leave behind is
// too squeezed to show the content it exists to show.
//
// GRID, not flex, and the 18rem rail is a TRACK rather than a width on the
// list. The two shapes lay out identically at the default (18rem + gap +
// remainder), but only the track is a single class an author can override: with
// the width on the item, changing the split meant overriding `md:w-72` on a
// list the author cannot reach AND `flex-1` on a panel they cannot reach
// either. As one `md:grid-cols-[…]` on the element the author's `className`
// lands on, `cn()` resolves it as a normal tailwind-merge conflict and one
// class re-proportions the whole set.
const TABS_ROOT_VERTICAL =
  'grid grid-cols-1 gap-6 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start'

/**
 * Compute the default className for the outer `<Tabs.Root>` wrapper.
 *
 * Returns the empty string for a horizontal tab set — the strip already sits
 * above the panel in normal block flow, so the root needs no layout of its own
 * and every existing consumer keeps byte-identical markup. A vertical tab set
 * needs a two-track grid (from `md` up) or the trigger column simply stacks
 * above the panel with its separator hairline dangling against nothing.
 *
 * This is the ONLY element that may carry the split. The SSR placeholder in
 * `island-form-components.tsx` emits the same classes on the single wrapper the
 * island's root replaces — applying them on a wrapper AND on the root nested
 * inside it made the real tab set a non-growing item of its own clone, so it
 * shrink-fit to its content and gave up most of the container's width
 *.
 */
export const computeTabsRootClasses = ({
  orientation = 'horizontal',
}: {
  orientation?: TabsOrientation
} = {}): string => (orientation === 'vertical' ? TABS_ROOT_VERTICAL : '')

// ──────────────────────────────────────────────────────────────────────────────
// TABS LIST (outer trigger strip with separator border)
// ──────────────────────────────────────────────────────────────────────────────

// `relative` is load-bearing, not cosmetic: `<Tabs.Indicator>` is absolutely
// positioned and Base UI measures its geometry against the list's
// `offsetParent`. Without a positioned list the indicator resolves against
// whatever ancestor happens to be positioned — which is how it ended up
// painting nowhere at all.
const TABS_LIST_LAYOUT = 'relative flex'

// Horizontal tab strips scroll on overflow rather than wrap/clip so a narrow
// viewport reflows the tab bar instead of truncating tabs
//. `overflow-x-auto` is inert at desktop
// width (no overflow → no scrollbar), so the desktop layout is unchanged.
const TABS_LIST_BORDER_HORIZONTAL = [
  'overflow-x-auto',
  'border-b',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

// The separator follows the responsive layout rather than fighting it: below
// `md` the column sits ABOVE the panel, so the separator is its bottom edge;
// from `md` up it moves beside the panel and the separator becomes its right
// edge. A bare `border-r` paints a hairline down the side of a full-width
// block.
//
// The rail carries NO width of its own: its width is the first grid track on
// the root (`TABS_ROOT_VERTICAL`). Keeping a `md:w-72` here as well would make
// the rail a second place the split is declared, and an author who
// re-proportioned the track would get a rail that ignored them.
const TABS_LIST_BORDER_VERTICAL = [
  'flex-col',
  'border-b md:border-b-0 md:border-r',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for the `<Tabs.List>` strip that houses the
 * tab triggers. The `orientation` axis flips the separator border between
 * `border-b` (horizontal: trigger strip sits above the panel) and a
 * responsive `border-b` → `md:border-r` + `flex-col` (vertical: trigger strip
 * stacks above the panel on a phone, then moves to its left from `md` up).
 * The border tone resolves to the standard `sv-border` so it reads as a faint
 * chrome line, not as a focal accent.
 */
export const computeTabsListClasses = ({
  orientation = 'horizontal',
}: {
  orientation?: TabsOrientation
} = {}): string =>
  [
    TABS_LIST_LAYOUT,
    orientation === 'vertical' ? TABS_LIST_BORDER_VERTICAL : TABS_LIST_BORDER_HORIZONTAL,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// TAB (single trigger button inside the list)
// ──────────────────────────────────────────────────────────────────────────────

const TAB_LAYOUT = 'px-4 py-2 text-base font-medium transition-colors'

// The leading caption of a horizontal strip gives up its left padding, and
// nothing else does.
//
// The strip's BOX has always started at the container edge — the list carries
// no padding — so the inset a reader sees is inside the first trigger: its own
// `px-4` pushed the caption 16px in while the heading above it and the panel
// below it both began at 0, and three edges that should be one column read as
// three. Measured on the spec fixture before this landed: strip box flush,
// caption 16px in.
//
// `first:pl-0` rather than dropping `px-4` from the recipe, because the padding
// is doing a second job between the triggers: without it the captions abut and
// the strip reads as one run-on word. Only the leading edge is given up.
//
// `<Tabs.Indicator>` renders AFTER the triggers inside `<Tabs.List>`, so the
// first `<Tabs.Tab>` really is `:first-child`. Moving the indicator ahead of
// them would silently un-flush the strip.
//
// Horizontal only. In a vertical rail `:first-child` is the TOP trigger, and
// taking its left padding away would step it out of line with every trigger
// beneath it — a ragged column, for a complaint that was never about one.
const TAB_LAYOUT_FLUSH_HORIZONTAL = 'first:pl-0'

// A column of triggers reads left-aligned; centring a two-line caption inside a
// fixed-width rail leaves both lines floating.
const TAB_LAYOUT_VERTICAL = 'text-left'

const TAB_DEFAULT_SURFACE = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
].join(' ')

// The accent edge is reserved on EVERY trigger and merely recoloured on the
// active one. Painting the 2px border only when active would make each trigger
// grow by 2px the moment it is selected — the strip reflows, and the caption of
// the active tab sits a pixel above its neighbours' for the whole time it is
// selected. Reserving the space costs nothing and holds the row still.
const TAB_ACCENT_RESERVED_HORIZONTAL = 'border-b-2 border-transparent'

const TAB_ACCENT_RESERVED_VERTICAL = 'border-l-2 border-transparent'

// Base UI marks the active trigger with `data-active`
// (`TabsTabDataAttributes.active`, @base-ui/react 1.6). The recipe keyed on
// `data-[selected]` — an attribute the primitive has never emitted — so every
// active-state class here matched nothing, on every tab set on the site, and no
// tab anywhere looked active.
//
// The accent edge follows the layout: an underline beneath a horizontal strip,
// a rail down the leading edge of a vertical column. The colours are canonical
// role utilities, NOT `var(--sv-…)` arbitrary values — see the note at the top
// of this file for why a bracketed variant cannot carry one.
const TAB_ACTIVE_SURFACE_HORIZONTAL = [
  'data-[active]:border-primary',
  'data-[active]:text-primary',
].join(' ')

const TAB_ACTIVE_SURFACE_VERTICAL = [
  'data-[active]:border-primary',
  'data-[active]:bg-background-subtle',
  'data-[active]:text-primary',
].join(' ')

/**
 * Compute the default className for a single `<Tabs.Tab>` trigger button.
 * The `state` axis is a forward-compat seam — Base UI exposes the active
 * state via `data-[active]` and the disabled branch via `data-[disabled]`
 * directly, so the recipe paints all three branches via data-attribute
 * variants without an explicit branch at call time. The default tone is
 * muted foreground (so non-active tabs read as orientation, not focal
 * content); the active tab flips to the primary tone with a primary accent
 * edge; disabled tabs dim to 50% opacity via the shared `DISABLED_INLINE`
 * recipe.
 *
 * A tab list is roving-tabindex — exactly one trigger is tabbable and the arrow
 * keys move between them — so the shared `focus-visible` ring is not optional
 * decoration: without it a keyboard reader cannot see where they are, and the
 * strip is unusable without a pointer.
 */
export const computeTabClasses = ({
  state: _state = 'default',
  orientation = 'horizontal',
}: {
  state?: TabState
  orientation?: TabsOrientation
} = {}): string =>
  [
    TAB_LAYOUT,
    orientation === 'vertical' ? TAB_LAYOUT_VERTICAL : TAB_LAYOUT_FLUSH_HORIZONTAL,
    TAB_DEFAULT_SURFACE,
    orientation === 'vertical' ? TAB_ACCENT_RESERVED_VERTICAL : TAB_ACCENT_RESERVED_HORIZONTAL,
    orientation === 'vertical' ? TAB_ACTIVE_SURFACE_VERTICAL : TAB_ACTIVE_SURFACE_HORIZONTAL,
    FOCUS_VISIBLE_RING,
    DISABLED_INLINE,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// TAB LABEL + TAB DESCRIPTION (the two lines of a captioned trigger)
// ──────────────────────────────────────────────────────────────────────────────

const TAB_LABEL_LAYOUT = 'block'

const TAB_DESCRIPTION_LAYOUT = 'mt-0.5 block text-sm font-normal'

const TAB_DESCRIPTION_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for the caption line of a trigger that also
 * carries a description. `block` is what makes the pair two LINES rather than
 * one run-on sentence. Carries no colour of its own so it inherits the
 * trigger's tone — including the primary flip when its tab is active.
 */
export const computeTabLabelClasses = (): string => TAB_LABEL_LAYOUT

/**
 * Compute the default className for the optional second line beneath a
 * trigger's caption. Smaller and muted so the caption still reads as the tab's
 * name at a glance; the muted tone is set explicitly rather than inherited so
 * the description stays supporting detail even on the active trigger, where the
 * caption turns primary.
 */
export const computeTabDescriptionClasses = (): string =>
  [TAB_DESCRIPTION_LAYOUT, TAB_DESCRIPTION_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// TAB INDICATOR (animated slide-under-selected underline)
// ──────────────────────────────────────────────────────────────────────────────

const TAB_INDICATOR_LAYOUT = 'absolute bottom-0 h-0.5 transition-all duration-200'

const TAB_INDICATOR_SURFACE = 'bg-primary'

/**
 * Compute the default className for the `<Tabs.Indicator>` element — the
 * thin primary-tone bar that Base UI slides under the selected trigger.
 * Layout (`absolute bottom-0 h-0.5`) and motion (`transition-all
 * duration-200`) stay as raw Tailwind because they encode behavior, not
 * color; the accent uses the canonical `bg-primary` role utility (always
 * minted by the default theme layer, resolving `--color-primary` which the
 * author `theme.colors.primary` bridge recolors), so the indicator picks up
 * tenant overrides while staying addressable as `.bg-primary`.
 */
export const computeTabIndicatorClasses = (): string =>
  [TAB_INDICATOR_LAYOUT, TAB_INDICATOR_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// TAB PANEL (content region below the strip)
// ──────────────────────────────────────────────────────────────────────────────

// `py-4`, NOT `p-4` — the panel reserves no horizontal gutter of its own
//.
//
// A panel is a block an author fills, and a 16px inset it cannot see in the
// config is 16px its content does not get: the panel body then starts to the
// right of the heading above the tab set and to the right of the first caption,
// so one column reads as three. An author who wants the inset back writes it —
// `design.components.tabs.parts.panel`, or a `container` around the body — and
// that is one line in a place that says so.
//
// The VERTICAL padding stays, and dropping it would be a different change than
// the one asked for: the complaint is horizontal ("a block taking the whole
// space, left to right"), and a panel whose first line sits hard against the
// strip's bottom border is a new defect, not the absence of an old one. In a
// vertical tab set the rail is separated from the panel by the root grid's
// `gap-6` instead, so the panel needs no left padding there either.
const TAB_PANEL_LAYOUT = 'py-4 text-md'

// The panel's width is the SECOND grid track on the root, so it needs no
// `flex-1` of its own. `min-w-0` stays and is not optional: a grid item
// defaults to `min-width: auto` exactly as a flex item does, so without it one
// wide code block inside would refuse to shrink and would blow the panel past
// its track instead of scrolling within it.
const TAB_PANEL_LAYOUT_VERTICAL = 'min-w-0'

const TAB_PANEL_SURFACE = `text-[${v('sv-fg', T.fg)}]`

/**
 * Compute the default className for the `<Tabs.Panel>` content region that
 * Base UI shows when its associated tab is selected. Uses the strong
 * foreground tone (full `sv-fg`, not muted) since this is the focal content
 * after the user picks a tab; `py-4` holds the panel off the strip without
 * reserving a horizontal gutter, so the body starts at the same edge as the
 * first caption above it. In a vertical tab set the panel fills the second grid
 * track beside the trigger rail.
 */
export const computeTabPanelClasses = ({
  orientation = 'horizontal',
}: {
  orientation?: TabsOrientation
} = {}): string =>
  [
    TAB_PANEL_LAYOUT,
    ...(orientation === 'vertical' ? [TAB_PANEL_LAYOUT_VERTICAL] : []),
    TAB_PANEL_SURFACE,
  ].join(' ')

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
