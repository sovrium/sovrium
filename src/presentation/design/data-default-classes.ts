/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the data-cluster surfaces
 *: the data-table shell + header row + body row + status badge,
 * the kanban column + card, and the chart shell. These are the outer-chrome
 * subparts that the `ui-kit-data` cluster snapshot showcases — the "schema
 * author's preview" of what a populated data display looks like.
 *
 * Each helper paints the COLOR / BORDER-COLOR / RADIUS / SHADOW classes
 * through {@link withVarFallback} so `app.design.*` overrides still win at
 * the CSS cascade layer (`var(--sv-X)` resolves the override first, falling
 * back to the inline OKLCH literal); layout / spacing classes (`flex
 * flex-col`, `grid grid-cols-4`, `gap-2`, `px-4`) stay raw — they encode
 * structure, not color. Mirrors the buttons + inputs + selects + toggles +
 * numeric + date + overlays + disclosure + feedback + navigation + layout
 * + forms slices.
 *
 * Subparts covered:
 *
 *   - DATA-TABLE SHELL      — the outer `<div>` wrapping a populated data
 *                             table (border + radius + bg + overflow-hidden).
 *                             The canonical "give me the table surface
 *                             chrome" computer; consumers that wrap a
 *                             header+rows composition reach for this. Also
 *                             consumed by the SSR placeholder in
 *                             `island-data-components.tsx` so the loading
 *                             skeleton paints the same chrome as the
 *                             hydrated island.
 *   - DATA-TABLE HEADER ROW — the header row above the body rows
 *                             (bg-bgSubtle + border-b + muted-fg + grid
 *                             composition), one type step under the body.
 *                             Pairs with the shell at the top of the table.
 *                             Not uppercased: see `TABLE_HEADER_TYPE`.
 *   - DATA-TABLE BODY ROW   — a body data row inside the table
 *                             (border-b + grid composition + selection
 *                             tint). The `state` parameter switches between
 *                             default rows, the currently-selected row (the
 *                             `bg-primary/5` highlight), and archived rows
 *                             (no border on the last row so the visual
 *                             trail-off matches the table shell's
 *                             `overflow-hidden` corner).
 *   - DATA-TABLE STATUS BADGE — the inline pill chip used in the status
 *                             column ("Active" / "Pending" / "Archived").
 *                             The `tone` parameter routes through the
 *                             semantic palette: `success` for active rows,
 *                             `warning` for pending, `muted` for archived /
 *                             retired states. Reads as accessory chrome on
 *                             top of the row's text content.
 *
 *   - KANBAN COLUMN         — the outer column wrapper holding a vertical
 *                             stack of cards (border + bg-bgSubtle + p-3 +
 *                             flex-col + gap-2). The subtle background pulls
 *                             the eye toward the column boundary; the cards
 *                             inside ride on the default bg surface so the
 *                             layer difference is legible.
 *   - KANBAN CARD           — an individual task card inside a column
 *                             (border + bg + radius + p-3, flat). It reads
 *                             as an actionable unit by sitting on the page
 *                             ground while the column around it is recessed
 *                             — a layer difference, not a shadow.
 *
 *   - CHART SHELL           — the outer wrapper around a visx chart canvas
 *                             (border + bg + radius + p-4). Pure surface
 *                             chrome — the chart content inside (bars,
 *                             lines, axes) carries its own color via the
 *                             theme palette + visx's `buildChartTheme`.
 *
 * Intentionally NOT covered (this slice scopes to what the `ui-kit-data`
 * cluster snapshot actually showcases — chart bar fills, data-table
 * internal subparts living inside `data-table/island/`, and other data
 * surfaces like `gallery` / `kpi` / `data-timeline` are out of scope for
 * this slice):
 *
 *   - CHART BAR FILL        — the `bg-primary` color on individual bars is
 *                             a single-class concern; wiring a helper that
 *                             proxies one token would only add indirection.
 *                             Reuses the same `sv-primary` var that buttons
 *                             already register, so theme overrides flow
 *                             through naturally.
 *   - DATA-TABLE INTERNALS  — sort icon, selection checkbox, pagination
 *                             footer, toolbar chrome, filter dropdowns,
 *                             column reorder UI, settings dialog: ALL live
 *                             inside `src/presentation/islands/data-table/`
 * and have their own [internal ref] follow-up tracked
 *                             separately. Restyling them needs the island-
 *                             side bundle to ship the var-fallback
 *                             registrations rather than an SSR-side helper.
 *   - GALLERY / KPI / TIMELINE — these have their own SSR placeholders in
 *                             `island-data-components.tsx` using the same
 *                             theme-classname recipe; a follow-up slice can
 *                             expand `data-default-classes.ts` to cover
 *                             them once the cluster fixture exercises them
 *                             (the current `ui-kit-data` cluster shows only
 *                             data-table + kanban + chart).
 *   - KANBAN COLUMN HEADER  — the "To do" / "In progress" label above the
 *                             cards is pure typography (`text-xs font-
 *                             semibold uppercase tracking-wider`) on the
 *                             muted-fg tone. Already painted via the same
 *                             `text-[var(--sv-fg-muted, …)]` recipe that
 *                             `table` header uses, so a dedicated
 *                             helper would only proxy two type utilities.
 *
 * Helper file lives in `src/presentation/ui/sections/renderers/element-
 * renderers/` (alongside the renderers that consume it) because both the
 * fixture surfaces and the production SSR placeholders are server-rendered
 * as part of the SSR pass — the `presentation-component → presentation-
 * island` layer boundary does not apply since this is purely a same-layer
 * helper. Mirrors the location chosen for `button-default-classes.ts`,
 * `input-default-classes.ts`, `feedback-default-classes.ts`,
 * `navigation-default-classes.ts`, `layout-default-classes.ts`, and
 * `forms-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { BADGE_RADIUS } from '@/presentation/design/navbar-default-classes'
import {
  computeTableHeaderCellClasses,
  computeTableShellClasses,
} from '@/presentation/design/table-default-classes'

/**
 * The type step of a table BODY cell: 12px, one rung above the 11px header
 * (`TABLE_HEADER_TYPE`) — the canvas' `td` 12 / `th` 11 pairing.
 *
 * A data table is a dense reading surface and the grid is what separates header
 * from body, so the header still needs no larger, heavier or uppercased
 * treatment to read as chrome. What changed is which row that argument shrinks.
 * The two used to share ONE 11px step; a table is read for its values, so the
 * values take the larger rung and the header keeps the smaller one.
 */
const TABLE_TEXT = 'text-sm'

// ──────────────────────────────────────────────────────────────────────────────
// DATA-TABLE SHELL — outer table wrapper
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the outer wrapper that surrounds a
 * populated data-table composition (header row + body rows + optional
 * summary footer).
 *
 * DELEGATES to {@link computeTableShellClasses}. Both the div-simulacrum drawn
 * here and the real `<table>` the island hydrates are the same SURFACE, so
 * they must not be able to disagree about it — and they had already started
 * to: this constant painted the frame on `sv-bg`, the page's own tone, where
 * the grid is meant to be a surface LIFTED off the ground on `sv-bg-raised`.
 * The delegation is what makes that a single decision rather than two.
 */
export const computeDataTableShellClasses = (): string => computeTableShellClasses()

// ──────────────────────────────────────────────────────────────────────────────
// DATA-TABLE HEADER ROW — uppercase chrome above the body rows
// ──────────────────────────────────────────────────────────────────────────────

// Row padding reads `--sv-density-row-y` rather than the `5px` literal it used
// to hard-code. The token's default is that same 5px, so the shipped table is
// unchanged; an authored `design.density` now reaches it.
/**
 * Compute the default className for the header row sitting above the body
 * rows of a data table.
 *
 * DELEGATES to {@link computeTableHeaderCellClasses}, for the same reason the
 * shell does. The header reads as chrome distinct from the body by WEIGHT and
 * by the stronger rule beneath it (`sv-border-strong`) rather than by a tinted
 * background or an uppercase, letter-spaced treatment — uppercasing a column
 * label costs legibility at this type step and buys emphasis the border
 * already supplies.
 *
 * Layout (`grid grid-cols-N gap-2`) stays the consumer's responsibility because
 * column count varies — the computer only ships padding, type, and colour.
 */
export const computeDataTableHeaderClasses = (): string => computeTableHeaderCellClasses()

// ──────────────────────────────────────────────────────────────────────────────
// DATA-TABLE BODY ROW — selection + last-row variants
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Body-row state lives on a 3-way switch:
 *   - `'default'`  — regular body row with bottom border
 *   - `'selected'` — currently-selected row, tinted with primary-subtle bg
 *   - `'last'`     — the last row in the table (no bottom border so the
 *                    shell's `overflow-hidden` doesn't clip a leftover
 *                    border-b stub)
 */
export type DataTableRowState = 'default' | 'selected' | 'last'

const DATA_TABLE_ROW_BASE = [
  'px-2 py-(--sv-density-row-y)',
  TABLE_TEXT,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

const DATA_TABLE_ROW_BORDER = ['border-b', `border-[${v('sv-border', T.border)}]`].join(' ')

const DATA_TABLE_ROW_SELECTED_TINT = `bg-[${v('sv-primary-subtle', T.primarySubtle)}]`

/**
 * Compute the default className for a body row inside a data table. The
 * `state` parameter switches the selection tint and the bottom-border
 * presence:
 *
 *   - `'default'` (default state): bottom border + neutral background.
 *   - `'selected'`: bottom border + `sv-primary-subtle` background tint so
 *     the row reads as the currently-selected record. Pairs with the
 *     primary palette already used by buttons + focus rings, so the tint
 *     adapts to whatever primary color the active theme sets.
 *   - `'last'`: NO bottom border (the table's `overflow-hidden` shell
 *     handles the visual termination via the rounded corners).
 *
 * Layout (`grid grid-cols-N gap-2`) stays the consumer's responsibility
 * because column count varies — only padding, type, and color are computed
 * here.
 */
export const computeDataTableRowClasses = ({
  state = 'default',
}: {
  readonly state?: DataTableRowState
} = {}): string =>
  [
    DATA_TABLE_ROW_BASE,
    ...(state === 'last' ? [] : [DATA_TABLE_ROW_BORDER]),
    ...(state === 'selected' ? [DATA_TABLE_ROW_SELECTED_TINT] : []),
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// DATA-TABLE STATUS BADGE — semantic pill chip (success/warning/muted)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Tone palette for the status badge:
 *   - `'success'` — green pill ("Active", "Approved", "Live")
 *   - `'warning'` — amber pill ("Pending", "Draft", "Review")
 *   - `'muted'`   — neutral pill ("Archived", "Inactive", "Disabled")
 */
export type DataTableStatusTone = 'success' | 'warning' | 'muted'

// The radius comes from `BADGE_RADIUS` rather than being spelled `rounded-full`
// here, because a status badge IS a badge and the two were drifting: the badge
// recipe retired the pill on the argument that a fully-rounded chip reads as a
// control affordance it does not have, and this one kept it. One import is the
// difference between that argument holding everywhere and holding in one file.
const STATUS_BADGE_BASE = [
  'inline-flex items-center w-fit px-2 py-0.5 text-xs font-medium',
  BADGE_RADIUS,
].join(' ')

const STATUS_BADGE_TONE: Record<DataTableStatusTone, string> = {
  success: [
    `bg-[${v('sv-success-bg', T.successBg)}]`,
    `text-[${v('sv-success-fg', T.successFg)}]`,
  ].join(' '),
  warning: [
    `bg-[${v('sv-warning-bg', T.warningBg)}]`,
    `text-[${v('sv-warning-fg', T.warningFg)}]`,
  ].join(' '),
  muted: [
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    'border',
    `border-[${v('sv-border', T.border)}]`,
  ].join(' '),
}

/**
 * Compute the default className for an inline status badge inside a
 * data-table status column. The `tone` parameter routes through the
 * semantic palette (`success` / `warning` / `muted`), all clipped to the
 * badge's own 2px radius rather than to a pill — a fully-rounded chip reads as
 * a control affordance a status label does not have, which is the argument the
 * badge recipe makes and this one now shares by importing `BADGE_RADIUS`.
 *
 * The `muted` tone carries an extra `border` ring because the bg-subtle +
 * fg-muted combination has very low contrast on its own — the border
 * gives the pill a definite edge so it doesn't visually dissolve into the
 * row background. Success and warning tones rely on the semantic bg/fg
 * pairing alone (no border) — the tone IS the affordance.
 */
export const computeDataTableStatusBadgeClasses = ({
  tone,
}: {
  readonly tone: DataTableStatusTone
}): string => [STATUS_BADGE_BASE, STATUS_BADGE_TONE[tone]].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// KANBAN COLUMN — card-stack container
// ──────────────────────────────────────────────────────────────────────────────

const KANBAN_COLUMN = [
  'p-3 flex flex-col gap-2',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for a kanban column — the outer container
 * holding a vertical stack of cards under a header label ("To do", "In
 * progress", "Done"). Paints a subtle background (`sv-bg-subtle`) so the
 * column boundary reads as a distinct region; the cards inside ride on the
 * default `sv-bg` surface so the layer difference is legible.
 *
 * Layout (`p-3 flex flex-col gap-2`) gives the header + cards a tight
 * vertical rhythm. Consumers wrap N columns inside a `grid grid-cols-N`
 * row at the board level — the grid itself is the consumer's concern,
 * only the per-column chrome lives here.
 */
export const computeKanbanColumnClasses = (): string => KANBAN_COLUMN

// ──────────────────────────────────────────────────────────────────────────────
// KANBAN CARD — individual task card
// ──────────────────────────────────────────────────────────────────────────────

const KANBAN_CARD = [
  'p-3 text-base',
  `bg-[${v('sv-bg', T.bg)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for an individual kanban card.
 *
 * FLAT on the default bg, reading as an actionable unit by contrast with the
 * recessed column surface (`sv-bg-subtle`) it sits on rather than by casting a
 * shadow. It carried `sv-shadow-sm` for exactly that job, and a layer
 * difference already did it — elevation belongs to surfaces that genuinely
 * float, which at rest a card in a column does not. The card being DRAGGED is
 * the one that does, and that is the drag ghost's own recipe.
 *
 * `text-base` (13px) + `text-fg` give the card title its reading weight;
 * secondary metadata layered inside relies on the consumer adding
 * `text-sm text-fg-muted` where appropriate.
 */
export const computeKanbanCardClasses = (): string => KANBAN_CARD

// ──────────────────────────────────────────────────────────────────────────────
// CHART SHELL — outer wrapper around the chart canvas
// ──────────────────────────────────────────────────────────────────────────────

const CHART_SHELL = [
  'p-4',
  `bg-[${v('sv-bg', T.bg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for the chart shell — the outer wrapper
 * around the visx SVG canvas (or its SSR loading skeleton). Pure surface
 * chrome: border + radius + bg + padding so the chart canvas (bars,
 * lines, axes, legends) reads as a self-contained card on the page.
 *
 * The chart canvas itself (inside) carries its own coloring via visx's
 * `buildChartTheme` — only the OUTER chrome is painted here. Consumed by
 * the cluster fixture's chart simulacrum and by the production SSR
 * placeholder in `island-chart-component.tsx` so the loading skeleton
 * paints the same shell as the hydrated chart.
 */
export const computeChartShellClasses = (): string => CHART_SHELL
