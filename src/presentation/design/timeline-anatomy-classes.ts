/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui card (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `timeline` drawn in shadcn/ui's colour roles and part names, in both of
 * its shapes. shadcn/ui has no timeline, so the parts are Sovrium's own, named
 * the way shadcn names a part and painted only with shadcn's role utilities,
 * so an app's `design` repaints them without a `--sv-*` hook.
 *
 * The record-bound Gantt (the `timeline` island):
 *
 *   div[data-slot=timeline]            the card surface (base-nova's Card ground and ring)
 *     div[data-slot=timeline-row]      one record's track
 *       div[data-slot=timeline-bar]    primary, or the record colour with a readable label
 *         span[data-slot=timeline-handle]
 *     div[data-slot=timeline-axis]     the dates, in the muted foreground
 *     div[data-slot=timeline-today]    a primary rule with a "Today" Badge
 *
 * The structural rail (`children`, no `dataSource`):
 *
 *   ol[data-slot=timeline]
 *     li[data-slot=timeline-item]
 *       span[data-slot=timeline-marker]     a primary dot ringed by the page
 *       span[data-slot=timeline-connector]  a hairline in the border colour
 */

// ──────────────────────────────────────────────────────────────────────────────
// GANTT
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The Gantt's frame: base-nova's Card ground and ring. The error, missing-
 * binding and empty states are status surfaces of their own, so the frame
 * steps out of the box (`contents`) around them: a misconfiguration never
 * reads as a timeline that happens to be empty.
 */
export const TIMELINE_SHELL_CLASSES =
  'w-full rounded-xl bg-card p-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-[>[role=alert]]:contents has-[>[data-timeline-state=empty]]:contents'

/** The band naming a swimlane (`groupBy`). */
export const TIMELINE_LANE_TITLE_CLASSES =
  'rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground'

/** One record's track: contiguous rows split by a hairline, so the plot scans across. */
export const TIMELINE_ROW_CLASSES = 'relative h-8 border-b border-border last:border-b-0'

/**
 * A bar. Without a `colorField` it is filled in the primary colour with its
 * label in the primary foreground; a coloured bar overrides both inline with
 * the record colour and the label colour derived to read against it.
 */
export const TIMELINE_BAR_CLASSES =
  'absolute top-1 flex h-6 items-center overflow-hidden rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground'

/** The bar's label, cut short rather than spilling out of its bar. */
export const TIMELINE_BAR_LABEL_CLASSES = 'truncate'

/** A record with no end date: a milestone, positioned on the axis with its label. */
export const TIMELINE_POINT_CLASSES = 'absolute inset-y-0 flex items-center gap-2'

/** The milestone's diamond, in the primary colour unless the record names one. */
export const TIMELINE_POINT_MARKER_CLASSES =
  'inline-block size-3 rotate-45 rounded-[2px] bg-primary'

/** The milestone's label, on the card ground. */
export const TIMELINE_POINT_LABEL_CLASSES = 'text-xs text-foreground'

/**
 * The axis under the plot, its dates in the muted foreground. Tall enough for
 * the "Today" badge to sit inside it, centred on its row.
 */
export const TIMELINE_AXIS_CLASSES =
  'mt-2 flex h-7 items-center justify-between border-t border-border text-xs text-muted-foreground tabular-nums'

/** The rule at the current date, over the rows and the axis. */
export const TIMELINE_TODAY_CLASSES = 'pointer-events-none absolute inset-y-0 z-10 w-px bg-primary'

/** Where the "Today" badge sits: in the axis row, centred on the rule. */
export const TIMELINE_TODAY_BADGE_PLACEMENT = 'absolute bottom-1 left-0 -translate-x-1/2'

/** A connector from a record to the one it follows. */
export const TIMELINE_DEPENDENCY_CLASSES =
  'pointer-events-none absolute top-0 h-1/2 min-w-px border-r border-b border-l border-muted-foreground'

// ──────────────────────────────────────────────────────────────────────────────
// RAIL
// ──────────────────────────────────────────────────────────────────────────────

/** The rail: an ordered list of the authored events. */
export const TIMELINE_RAIL_CLASSES = 'flex flex-col'

/** One event: its marker column, then the authored child. */
export const TIMELINE_ITEM_CLASSES = 'group/item flex gap-3'

/** The column holding the marker and the connector down to the next event. */
export const TIMELINE_ITEM_RAIL_CLASSES = 'flex w-2 shrink-0 flex-col items-center'

/** The marker: a primary dot, set off from the connector by a ring of the page ground. */
export const TIMELINE_MARKER_CLASSES =
  'mt-2 size-2 shrink-0 rounded-full bg-primary ring-4 ring-background'

/** The connector from one event to the next: a hairline in the border colour. */
export const TIMELINE_CONNECTOR_CLASSES = 'mt-1 w-px flex-1 bg-border'

/** The authored child, with room before the next event. */
export const TIMELINE_ITEM_CONTENT_CLASSES = 'min-w-0 flex-1 pb-6 text-sm group-last/item:pb-0'
