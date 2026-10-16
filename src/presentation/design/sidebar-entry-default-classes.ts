/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui sidebar (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The rows of a sidebar, as a leaf module: the top-level entry (`sidebar-menu-button`),
 * the nested entry (`sidebar-menu-sub-button`) and the disclosure that reveals the
 * nested ones — its row, its toggle, its list and that list's loading line.
 * `sidebar-default-classes.ts` re-exports every computer here; the departures from
 * base-nova these recipes carry are written down in that module's header.
 */

// ──────────────────────────────────────────────────────────────────────────────
// SIDEBAR ENTRIES — top-level and nested rows
// ──────────────────────────────────────────────────────────────────────────────

/**
 * A top-level row (`sidebar-menu-button`, size `default`): base-nova's
 * `sidebarMenuButtonVariants` base and default variant, minus the parts that
 * read an absolutely placed action and the `data-active:` fill (see the
 * departures in `sidebar-default-classes.ts`). Folded to icons it squares to 32 px, so its
 * `overflow-hidden` clips the label away under the glyph: the label stays in
 * the document and keeps naming the link.
 *
 * Its ink is spelled out (`text-sidebar-foreground`) where base-nova lets it
 * inherit from the box: the row is an `<a>`, and the base layer paints every
 * bare link in the app's primary colour, so an inherited ink turned every
 * resting row into a coloured link. The ink matches the nested row's, and
 * only the current row is marked, by the accent fill.
 */
const SIDEBAR_ENTRY_CLASS =
  'peer/menu-button group/menu-button flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm text-sidebar-foreground ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[collapsible=icon]/sidebar:size-8! group-data-[collapsible=icon]/sidebar:p-2! [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate'

/**
 * A resting row's glyph, a step quieter than its label, so the label carries
 * the row; hovering the row brings the glyph up to the row's hover ink. The
 * current row keeps its glyph at full ink, with its label.
 */
const SIDEBAR_ENTRY_REST_GLYPH =
  '[&_svg]:text-sidebar-foreground/70 hover:[&_svg]:text-sidebar-accent-foreground'

/** A resting row: the row and its quieter glyph. */
const SIDEBAR_ENTRY_REST_CLASS = `${SIDEBAR_ENTRY_CLASS} ${SIDEBAR_ENTRY_REST_GLYPH}`

/** The row for the page being viewed: base-nova's active fill, weight and ink. */
const SIDEBAR_ENTRY_CURRENT_CLASS = [
  SIDEBAR_ENTRY_CLASS,
  'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
].join(' ')

/** A nested row (`sidebar-menu-sub-button`, size `md`). */
const SIDEBAR_SUB_ENTRY_CLASS =
  'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground'

const SIDEBAR_SUB_ENTRY_CURRENT_CLASS = [
  SIDEBAR_SUB_ENTRY_CLASS,
  'bg-sidebar-accent text-sidebar-accent-foreground',
].join(' ')

/**
 * Compute the className for a single top-level navigation entry `<a>`; the
 * current one takes the sidebar accent's fill, weight and ink.
 */
export const computeSidebarEntryClasses = (isCurrent = false): string =>
  isCurrent ? SIDEBAR_ENTRY_CURRENT_CLASS : SIDEBAR_ENTRY_REST_CLASS

/**
 * Compute the className for a nested navigation entry `<a>` — anything a
 * disclosure reveals, at either depth.
 */
export const computeSidebarSubEntryClasses = (isCurrent = false): string =>
  isCurrent ? SIDEBAR_SUB_ENTRY_CURRENT_CLASS : SIDEBAR_SUB_ENTRY_CLASS

// ──────────────────────────────────────────────────────────────────────────────
// SIDEBAR DISCLOSURE — expandable entry: row / toggle / child list / states
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The row holding an expandable entry's link and its toggle.
 *
 * A two-column grid rather than a flex row, because the child LIST is a third
 * item that has to sit BELOW both and span them. The island host between them
 * carries `display: contents`, so the button and the list it renders become
 * direct items of this grid rather than of a wrapper the layout would have to
 * work around.
 */
const SIDEBAR_DISCLOSURE_ROW_LAYOUT =
  'grid grid-cols-[1fr_auto] items-center gap-0.5 group-data-[collapsible=icon]/sidebar:block'

/**
 * The chevron button beside an expandable row that has a page of its own
 * (`sidebar-menu-action`): base-nova's action, in its own grid column with a
 * 24 px target (see the departures in `sidebar-default-classes.ts`).
 */
const SIDEBAR_DISCLOSURE_TOGGLE_CLASS =
  'flex size-6 shrink-0 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 group-data-[collapsible=icon]/sidebar:hidden [&>svg]:size-4 [&>svg]:shrink-0'

/**
 * The WHOLE row as one toggle — an entry that declares no destination.
 *
 * It takes the ordinary entry's geometry and tone, and the difference from
 * {@link SIDEBAR_ENTRY_CLASS} is entirely in what it does NOT have: there is no
 * `current` variant, and there never will be. `aria-current` says "this is the
 * page you are on", and a row that goes nowhere is not a page — so a selected
 * fill here would be the same lie in colour that the mark is in the
 * accessibility tree. Hover is the only state it answers to.
 *
 * `col-span-2` because it replaces BOTH cells of the disclosure grid: the link
 * and the small chevron beside it have become one control, and the list below
 * still spans the same two columns.
 *
 * The chevron travels wrapped in {@link SIDEBAR_TOGGLE_CHEVRON_SLOT_CLASS}, so
 * the rail can stop painting it along with the label and the badge.
 */
const SIDEBAR_TOGGLE_ROW_CLASS = `col-span-2 ${SIDEBAR_ENTRY_REST_CLASS}`

/**
 * The label inside a toggle row, which GROWS.
 *
 * One mechanism pushes the badge and the chevron to the right edge, rather than
 * an `ml-auto` on each of them — two auto margins in one flex row split the free
 * space between themselves, which would leave a badged toggle with a gap in the
 * middle of it and the chevron adrift.
 */
const SIDEBAR_TOGGLE_LABEL_CLASS = 'flex-1'

/**
 * The chevron's slot in a toggle row: a wrapper, so the chevron is a `span`
 * the rail can stop painting along with the label and the badge.
 */
const SIDEBAR_TOGGLE_CHEVRON_SLOT_CLASS = 'flex shrink-0 items-center'

/** The chevron inside a toggle: rotated a quarter turn while open. */
const SIDEBAR_DISCLOSURE_CHEVRON_CLASS = 'transition-transform duration-150'

/**
 * The nested list a disclosure reveals (`sidebar-menu-sub`): base-nova's
 * indented, rule-led list, spanning both columns of the disclosure row.
 */
const SIDEBAR_DISCLOSURE_LIST_CLASS =
  'col-span-2 mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]/sidebar:hidden'

/** The loading / empty / error line standing in for a fetched list. */
const SIDEBAR_DISCLOSURE_STATE_CLASS =
  'flex h-7 items-center px-2 text-xs text-sidebar-foreground/70'

/** Compute the className for an expandable entry's row (link + toggle + list). */
export const computeSidebarDisclosureRowClasses = (): string => SIDEBAR_DISCLOSURE_ROW_LAYOUT

/** Compute the className for a disclosure's toggle button. */
export const computeSidebarDisclosureToggleClasses = (): string => SIDEBAR_DISCLOSURE_TOGGLE_CLASS

/**
 * Compute the className for a whole row that IS the toggle — an entry declaring
 * no destination. Hover only: it has no current state, by construction.
 */
export const computeSidebarToggleRowClasses = (): string => SIDEBAR_TOGGLE_ROW_CLASS

/** Compute the className for the growing label inside a toggle row. */
export const computeSidebarToggleLabelClasses = (): string => SIDEBAR_TOGGLE_LABEL_CLASS

/** Compute the className for the chevron's wrapper inside a toggle row. */
export const computeSidebarToggleChevronSlotClasses = (): string =>
  SIDEBAR_TOGGLE_CHEVRON_SLOT_CLASS

/** Compute the className for a disclosure's chevron, rotated while open. */
export const computeSidebarDisclosureChevronClasses = (expanded = false): string =>
  expanded ? `${SIDEBAR_DISCLOSURE_CHEVRON_CLASS} rotate-90` : SIDEBAR_DISCLOSURE_CHEVRON_CLASS

/** Compute the className for a disclosure's sub-entry list. */
export const computeSidebarDisclosureListClasses = (): string => SIDEBAR_DISCLOSURE_LIST_CLASS

/** Compute the className for a fetched list's loading, empty or error line. */
export const computeSidebarDisclosureStateClasses = (): string => SIDEBAR_DISCLOSURE_STATE_CLASS
