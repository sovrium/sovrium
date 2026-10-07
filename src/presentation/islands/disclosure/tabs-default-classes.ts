/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { FOCUS_VISIBLE_RING } from '@/presentation/design/shared-tokens-default-classes'
import { DISABLED_INLINE } from './disclosure-default-classes'

/**
 * Default classes for the tabs family: root, list, tab, label, description,
 * indicator and panel, in both orientations.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

type TabsOrientation = 'horizontal' | 'vertical'
type TabState = 'default' | 'active' | 'disabled'

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
 * shrink-fit to its content and gave up most of the container's width.
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
// viewport reflows the tab bar instead of truncating tabs.
// `overflow-x-auto` is inert at desktop
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
//
// The active LABEL is the foreground, not the primary: the accent edge carries
// the primary and is free to be any hue, while the label has to read at 4.5:1
// on whatever ground the strip sits on — and an app's primary, chosen for fills
// and edges, often does not (a mid teal read 4.26:1 on a subtle strip).
const TAB_ACTIVE_SURFACE_HORIZONTAL = [
  'data-[active]:border-primary',
  'data-[active]:text-foreground',
].join(' ')

const TAB_ACTIVE_SURFACE_VERTICAL = [
  'data-[active]:border-primary',
  'data-[active]:bg-background-subtle',
  'data-[active]:text-foreground',
].join(' ')

/**
 * Compute the default className for a single `<Tabs.Tab>` trigger button.
 * The `state` axis is a forward-compat seam — Base UI exposes the active
 * state via `data-[active]` and the disabled branch via `data-[disabled]`
 * directly, so the recipe paints all three branches via data-attribute
 * variants without an explicit branch at call time. The default tone is
 * muted foreground (so non-active tabs read as orientation, not focal
 * content); the active tab flips to the foreground tone with a primary
 * accent edge; disabled tabs dim to 50% opacity via the shared `DISABLED_INLINE`
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

// `py-4`, NOT `p-4` — the panel reserves no horizontal gutter of its own.
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
