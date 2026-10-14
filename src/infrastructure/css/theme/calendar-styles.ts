/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CALENDAR_DAY_FLOOR_RULES } from './calendar-day-floor-styles'

/**
 * FullCalendar theming stylesheet, on shadcn/ui's roles.
 *
 * FullCalendar keeps drawing the event calendar's grid; this file gives it the
 * theme. Version 7 ships its look as a theme — hashed classes plus a
 * `theme.css` the calendar island delivers (`islands/calendar/calendar-stylesheet.ts`)
 * — and that stylesheet reads every colour from `--fc-classic-*` variables
 * whose factory values live in a `palette.css` the island deliberately does
 * NOT load. This file supplies them from the theme's roles (`--color-border`,
 * `--color-muted-foreground`, `--color-primary` …), so an app's `design` and
 * the dark scheme reach the calendar with no input of its own.
 *
 * The block is PLAIN CSS composed into `buildSourceCSS`
 * (`infrastructure/css/compiler.ts`): it flows through both compile engines,
 * and Tailwind cannot express a `.fc-*` selector as a utility.
 *
 * ## The class names this file selects
 *
 * Version 7's own DOM carries hashed classes only. The semantic names below —
 * `.fc-event`, `.fc-daygrid-day`, `.fc-col-header-cell` … — are put back by
 * the island through FullCalendar's class hooks
 * (`islands/calendar/calendar-dom-classes.ts`); they are also the names the
 * calendar specs locate by. Every selector is `.fc <part>` (0,2,0) or better,
 * above the theme's single hashed classes, and both sheets are unlayered.
 *
 * ## The drawing
 *
 * The board's: hairlines in `border`, weekday heads `text-xs font-medium` in
 * the muted foreground, a day number in a 24px box with today's filled as a
 * `primary` circle, events `rounded-md` `text-xs` on the `secondary` surface
 * and its foreground. A timed event in a day row is a dot in the theme's
 * `primary`. A `colorField` event keeps its option colour: the island sets
 * `--fc-event-color` / `--fc-event-contrast-color` inline per event, and those
 * outrank the role defaults below.
 */

/**
 * The `--fc-classic-*` → theme-role bridge, scoped to the calendar root.
 *
 * `--fc-classic-event` is the theme's `primary`, which a timed event's dot
 * reads. A block event (`EVENT_RULES`) rebinds it to the `secondary` surface on
 * its own element: FullCalendar writes `--fc-event-color: var(--fc-classic-event)`
 * inline on every event root, so the rebinding resolves per element.
 */
const FC_VAR_BRIDGE = `.fc {
      --fc-classic-button: var(--color-background);
      --fc-classic-button-border: var(--color-border);
      --fc-classic-button-strong: var(--color-muted);
      --fc-classic-button-strong-border: var(--color-input);
      --fc-classic-button-outline: var(--color-ring);
      --fc-classic-button-foreground: var(--color-foreground);
      --fc-classic-primary: var(--color-primary);
      --fc-classic-primary-foreground: var(--color-primary-foreground);
      --fc-classic-event: var(--color-primary);
      --fc-classic-event-contrast: var(--color-primary-foreground);
      --fc-classic-background-event: var(--color-primary);
      --fc-classic-background-event-opacity: 15%;
      --fc-classic-background-event-foreground-opacity: 50%;
      --fc-classic-highlight: var(--color-accent);
      --fc-classic-today: transparent;
      --fc-classic-now: var(--color-destructive);
      --fc-classic-small-dot-width: 6px;
      --fc-classic-large-dot-width: 8px;
      --fc-classic-background: var(--color-background);
      --fc-classic-faint: var(--color-muted);
      --fc-classic-muted: var(--color-muted);
      --fc-classic-strong: var(--color-border);
      --fc-classic-foreground: var(--color-foreground);
      --fc-classic-faint-foreground: var(--color-muted-foreground);
      --fc-classic-muted-foreground: var(--color-muted-foreground);
      --fc-classic-border: var(--color-border);
      --fc-classic-strong-border: var(--color-border);
    }`

/**
 * The grid's hairlines — one weight, the `border` role, as shadcn/ui's table
 * and calendar draw them — and the weekday heads.
 *
 * `!important` because FullCalendar's skeleton zeroes the edges a cell shares
 * with its neighbour through `!important` shorthands (`border-top: 0`), which
 * also reset that edge's colour to `currentColor`. The width stays zero; the
 * colour comes back, so every edge of the grid reports the hairline role.
 *
 * `text-decoration: none` on the cushion is not cosmetic: it is an `<a>` when
 * `navLinks` is on, and its default underline reappears the moment an author
 * enables them.
 */
const GRID_RULES = `.fc .fc-daygrid-day,
    .fc .fc-timegrid-slot,
    .fc .fc-timegrid-col,
    .fc .fc-col-header-cell {
      border-color: var(--color-border) !important;
    }

    .fc .fc-col-header-cell {
      padding: 6px 0;
      text-align: center;
      font-size: var(--text-xs);
      line-height: 1rem;
      font-weight: 500;
      color: var(--color-muted-foreground);
    }

    .fc .fc-col-header-cell-cushion {
      display: inline-block;
      padding: 0;
      color: inherit;
      text-decoration: none;
    }`

/**
 * Month day cell and its number.
 *
 * The 3px/4px inset lives on the CELL, so the number row and the event stack
 * are both inset by one padding. Today carries no wash (`--fc-classic-today`
 * is transparent): the primary circle on its number is the only mark, so a
 * `secondary` event chip keeps its ground on today's cell in either scheme.
 * Every number sits in the same 24px box, so today's circle does not move its
 * row; `inline-flex` + centring keeps a one- and a two-digit date
 * identical inside it.
 *
 * Measure an in-month number with
 * `.fc-daygrid-day:not(.fc-day-other) .fc-daygrid-day-number`: the first
 * number in DOM order is usually the previous month's trailing day.
 */
const DAY_CELL_RULES = `.fc .fc-daygrid-day {
      padding: 3px 4px;
    }

    .fc .fc-daygrid-day-top {
      padding: 0;
    }

    .fc .fc-daygrid-day-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border-radius: 9999px;
      font-size: var(--text-xs);
      line-height: 1;
      color: var(--color-foreground);
      text-decoration: none;
    }

    .fc .fc-day-other .fc-daygrid-day-number {
      color: var(--color-muted-foreground);
    }

    .fc .fc-day-today .fc-daygrid-day-number {
      background-color: var(--color-primary);
      color: var(--color-primary-foreground);
    }`

/**
 * Event chips and the "+N more" link.
 *
 * A block or time-grid event rebinds `--fc-classic-event` to the `secondary`
 * surface on its own element (see {@link FC_VAR_BRIDGE}); its label is
 * re-asserted on the root from FullCalendar's per-event
 * `--fc-event-contrast-color`, so the element a reader or an audit inspects
 * reports the fill and its ink together. A dot event has no fill and keeps
 * the page's text colour.
 *
 * An event the author styles through the calendar's `event` part is marked
 * `sv-event-part`, and its fill and ink step back to the layered utilities
 * (`revert-layer`): both sheets here are unlayered and would otherwise win.
 */
const EVENT_RULES = `.fc .fc-daygrid-block-event,
    .fc .fc-timegrid-event {
      --fc-classic-event: var(--color-secondary);
      --fc-classic-event-contrast: var(--color-secondary-foreground);
      color: var(--fc-event-contrast-color);
    }

    .fc .fc-daygrid-event,
    .fc .fc-timegrid-event {
      border-radius: var(--radius-md);
    }

    .fc .fc-event-main {
      font-size: var(--text-xs);
      line-height: 1rem;
    }

    .fc .fc-daygrid-event {
      padding: 1px 6px;
      margin: 2px 0 0;
    }

    .fc .fc-daygrid-event .fc-event-main,
    .fc .fc-daygrid-event .fc-event-time,
    .fc .fc-daygrid-event .fc-event-title {
      padding: 0;
    }

    .fc .fc-event-title,
    .fc .fc-event-time {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .fc .fc-daygrid-day-bottom {
      margin: 0;
      font-size: var(--text-xs);
    }

    .fc .sv-event-part,
    .fc .sv-event-part * {
      background-color: revert-layer;
      color: revert-layer;
    }

    .fc .fc-daygrid-more-link,
    .fc .fc-timegrid-more-link {
      padding: 0 4px;
      border-radius: var(--radius-md);
      font-size: var(--text-xs);
      line-height: 1rem;
      background-color: transparent;
      color: var(--color-muted-foreground);
    }

    .fc .fc-daygrid-more-link:hover,
    .fc .fc-timegrid-more-link:hover {
      background-color: var(--color-muted);
      color: var(--color-foreground);
    }`

/**
 * Time-grid: gutter, slot labels, all-day row, today column.
 *
 * The 44px gutter is declared on the cells that FORM the column (the header
 * axis and the slot labels), because FullCalendar sizes that column from its
 * cells. The 24px slot row is the island's `slotMinHeight`
 * (`islands/calendar/calendar-options.ts`): FullCalendar 7 sizes slots in
 * script. The today column stays on the page's background — a full-height
 * tint would dominate the view.
 */
const TIME_GRID_RULES = `.fc .fc-timegrid-axis,
    .fc .fc-timegrid-slot-label {
      width: 44px;
    }

    .fc .fc-timegrid-slot-label-cushion,
    .fc .fc-timegrid-axis-cushion {
      padding: 0 4px;
      font-size: var(--text-xs);
      line-height: 1rem;
      color: var(--color-muted-foreground);
    }

    .fc .fc-timegrid-axis-cushion {
      padding: 5px 4px;
    }

    .fc .fc-timegrid .fc-daygrid-day-frame {
      min-height: 22px;
    }

    .fc .fc-timegrid-col.fc-day-today {
      background-color: var(--color-background);
    }`

/**
 * The current-time indicator: a 1px `destructive` line with a 7px dot at its
 * left end. Zeroing the border width dismantles FullCalendar's CSS-triangle
 * arrow; the explicit box paints the dot, re-centred on the line.
 */
const NOW_INDICATOR_RULES = `.fc .fc-timegrid-now-indicator-line {
      border-width: 1px 0 0;
      border-top-color: var(--color-destructive);
    }

    .fc .fc-timegrid-now-indicator-arrow {
      border-width: 0;
      width: 7px;
      height: 7px;
      margin-top: -3px;
      border-radius: 9999px;
      background-color: var(--color-destructive);
    }`

/**
 * Generate the calendar stylesheet. It takes no argument: every value is a
 * fixed geometry or an indirection into a theme role, so an author's `design`
 * reaches the calendar without this generator knowing the author exists.
 */
export function generateCalendarStyles(): string {
  return [
    '/* ── Calendar (FullCalendar) theming ── */',
    FC_VAR_BRIDGE,
    GRID_RULES,
    DAY_CELL_RULES,
    EVENT_RULES,
    TIME_GRID_RULES,
    NOW_INDICATOR_RULES,
    CALENDAR_DAY_FLOOR_RULES,
  ].join('\n\n    ')
}
