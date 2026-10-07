/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CALENDAR_DAY_FLOOR_RULES } from './calendar-day-floor-styles'

/**
 * FullCalendar theming stylesheet (wave R-D, the `calendar` data view).
 *
 * FullCalendar receives NO Sovrium tokens without this file. Version 7 ships
 * its look as a theme — a plugin of hashed class names plus a `theme.css`
 * that the calendar island delivers (`islands/calendar/calendar-stylesheet.ts`)
 * — and that stylesheet reads every colour from `--fc-classic-*` variables
 * whose factory values (its `#3788d8` event blue among them) live in a
 * `palette.css` the island deliberately does NOT load. This file supplies them,
 * bound to the `--sv-*` tokens, and lays the canvas geometry on top.
 *
 * The block is PLAIN CSS composed into `buildSourceCSS`
 * (`infrastructure/css/compiler.ts`) beside `generateCodeBlockStyles` and
 * `generateMarqueeStyles`, for exactly the two reasons those two are there:
 *
 *  - **It flows through BOTH compile engines** (`buildSourceCSS` feeds both), so
 *    a rule written here needs no Tailwind candidate scan to be served.
 *  - **Tailwind cannot express it.** `.fc-daygrid-day` is not utility-shaped.
 *    The compiler is candidate-driven rather than source-scanning, so a
 *    `.fc-*` selector could never be minted as a utility.
 *
 * ## The class names this file selects
 *
 * Version 7's own DOM carries hashed classes only (`fc-classic-YjJ`), which no
 * stylesheet should select. The semantic names below — `.fc-event`,
 * `.fc-daygrid-day`, `.fc-timegrid-slot`, `.fc-col-header-cell` … — are put
 * back by the island through FullCalendar's class hooks
 * (`islands/calendar/calendar-dom-classes.ts`), and they are the same names the
 * calendar specs locate by. So the grid is themed from the outside, on a
 * vocabulary Sovrium owns; only the toolbar is replaced, with Sovrium markup
 * driven by `calendar-default-classes.ts`.
 *
 * ## Two rule weights, deliberately — the single most visible calendar error
 *
 * The canvas uses `hair` (`--sv-border`) for the OUTER separators — under the
 * weekday header, under the all-day row, and the scrollgrid frame — and `well`
 * (`--sv-bg-subtle`, much fainter) for the INNER grid rules between cells.
 * Collapsing them into one weight is what makes a themed calendar still read as
 * unthemed: every line the same weight is the FullCalendar default look.
 *
 * The classic theme draws every cell edge from ONE variable
 * (`--fc-classic-border`), so the split cannot come from the variable bridge.
 * That variable is bound to `hair` — the outer weight — and the inner parts
 * are then walked back to `well` by explicit rules below.
 *
 * ## How these rules win
 *
 *  1. **The variable bridge is the only source.** The `--fc-classic-*`
 *     variables are declared nowhere else on the page, so the `.fc` block below
 *     is not winning a contest — it is the definition. Leaving one out would
 *     not fall back to a FullCalendar colour; it would leave the property
 *     unresolved, which is why the bridge lists the classic palette in full.
 *  2. **The geometry rules win by SPECIFICITY and ORDER.** The theme's rules
 *     are single hashed classes (0,1,0); every selector here is written
 *     `.fc <part>` (0,2,0) or better. The island also PREPENDS FullCalendar's
 *     `<style>` to `<head>`, so the compiled Sovrium stylesheet follows it.
 *     Both sheets are UNLAYERED — these rules are emitted at `buildSourceCSS`
 *     top level, not inside an `@layer` — so no cascade-layer ordering enters.
 *
 * ## What this file deliberately does NOT paint
 *
 *  - **Event FILL.** `option-colors.spec.ts` reads the computed
 *    `background-color` / `color` off `.fc-event` and asserts an AA contrast
 *    pair derived from the author's declared option colour. FullCalendar sets
 *    the per-event `--fc-event-color` / `--fc-event-contrast-color` inline on
 *    the event root, and the theme paints from them; only the label tone is
 *    re-asserted on the root (see `EVENT_RULES`), from the same variable.
 *  - **The event border.** FullCalendar draws it in the event's own colour, so
 *    it is invisible anyway and removing it buys nothing but risk.
 *  - **The tinted-vs-filled event variants.** The canvas draws a `well` fill
 *    with a 2px series-hue left rule for a "tinted" event and a solid hue for a
 *    "filled" one. Which of the two an event gets is a DATA decision made in
 *    `record-to-event.ts`, not a CSS one; converging it is a separate change.
 */

/**
 * The `--fc-classic-*` → `--sv-*` bridge, scoped to the calendar root.
 *
 * Every value is an indirection into an existing `--sv-*` token, so the block
 * needs no author input and no schema surface — and a tenant's `app.design`
 * override follows for free, because the override rebinds the `--sv-*` the
 * bridge points at. Dark mode follows the same way: the tokens carry it, so the
 * theme's own `[data-color-scheme=dark]` palette is not needed either.
 *
 * An event with no `colorField` wears the theme's `primary`, in its dark value
 * under the dark scheme, and its text the `primary-fg` the theme pairs with it
 * — the pair every primary button already reads at. A `colorField` chip keeps
 * its option colour: the island sets that per event, and it outranks these.
 */
const FC_VAR_BRIDGE = `.fc {
      --fc-classic-button: var(--sv-bg-raised);
      --fc-classic-button-border: var(--sv-border);
      --fc-classic-button-strong: var(--sv-bg-subtle);
      --fc-classic-button-strong-border: var(--sv-border-strong);
      --fc-classic-button-outline: var(--sv-focus-ring);
      --fc-classic-button-foreground: var(--sv-fg);
      --fc-classic-primary: var(--sv-primary);
      --fc-classic-primary-foreground: var(--sv-primary-fg);
      --fc-classic-event: var(--sv-primary);
      --fc-classic-event-contrast: var(--sv-primary-fg);
      --fc-classic-background-event: var(--sv-success-solid);
      --fc-classic-background-event-opacity: 15%;
      --fc-classic-background-event-foreground-opacity: 50%;
      --fc-classic-highlight: var(--sv-bg-subtle);
      --fc-classic-today: var(--sv-bg-subtle);
      --fc-classic-now: var(--sv-error-solid);
      --fc-classic-small-dot-width: 6px;
      --fc-classic-large-dot-width: 8px;
      --fc-classic-background: var(--sv-bg);
      --fc-classic-faint: var(--sv-bg-subtle);
      --fc-classic-muted: var(--sv-bg-subtle);
      --fc-classic-strong: var(--sv-border);
      --fc-classic-foreground: var(--sv-fg);
      --fc-classic-faint-foreground: var(--sv-fg-subtle);
      --fc-classic-muted-foreground: var(--sv-fg-muted);
      --fc-classic-border: var(--sv-border);
      --fc-classic-strong-border: var(--sv-border-strong);
    }`

/**
 * The INNER grid rules — the `well` half of the two-weight split.
 *
 * Month day cells, time-grid slot rows and time-grid columns are all interior
 * separators. The month day cell keeps `hair` on nothing at all; the all-day
 * row walks its bottom edge back to `hair` further down, because that edge is
 * an OUTER separator that happens to sit on a `.fc-daygrid-day`.
 */
const INNER_GRID_RULES = `.fc .fc-daygrid-day,
    .fc .fc-timegrid-slot,
    .fc .fc-timegrid-col {
      border-color: var(--sv-bg-subtle);
    }`

/**
 * Weekday header row.
 *
 * Canvas: 10px / 500 / `muted`, 4px vertical padding, centred, with a `hair`
 * rule beneath. The column separators through the header are INNER, so the
 * shorthand lays `well` on all four edges and the bottom is then raised to
 * `hair` — the one place both weights meet on one element.
 *
 * `text-decoration: none` is not cosmetic: the cushion is an `<a>` when
 * `navLinks` is on, and its default underline reappears the moment an author
 * enables them.
 */
const HEADER_RULES = `.fc .fc-col-header-cell {
      border-color: var(--sv-bg-subtle);
      border-bottom-color: var(--sv-border);
      padding: 4px 0;
      text-align: center;
    }

    .fc .fc-col-header-cell-cushion {
      display: inline-block;
      padding: 0;
      font-size: var(--text-2xs);
      line-height: 1.4;
      font-weight: 500;
      color: var(--sv-fg-muted);
      text-decoration: none;
    }`

/**
 * Month day cell: box, day number, and the today badge.
 *
 * The 3px/4px inset lives on the CELL: in FullCalendar 7 the cell is the
 * element that carries the today tint, and the number row and the event stack
 * are its two children, so one padding insets both without the tint stopping
 * short. (The row height itself is FullCalendar's — see `aspectRatio` in
 * `islands/calendar/calendar-options.ts`.)
 *
 * The day number's own padding is therefore zeroed — it would otherwise
 * compound with the cell inset — and the horizontal event margins with it, so
 * chips align on the same 4px gutter as the number instead of a 6px one.
 *
 * The today badge is a 16 × 16 `primary` circle. `inline-flex` + centring is
 * what makes a one- and a two-digit date sit identically inside it; a padded
 * inline box would grow with the digit count and stop being a circle on the
 * 10th of the month.
 *
 * ## Sampling a day number: use `:not(.fc-day-other)`
 *
 * An in-month number is `sv-fg-muted` and an out-of-month one is
 * `sv-fg-subtle`, per the canvas. A live measurement that reads "the day
 * number" generically will almost always land on the WRONG one: the first
 * `.fc-daygrid-day-number` in DOM order is the top-left cell, which is the
 * previous month's trailing day in every month that does not start on the
 * week's first day. With `firstDay={1}`, September 2026 opens on Mon 31 Aug —
 * so `.first()` reports `sv-fg-subtle` on a perfectly correct grid. Measure
 * `.fc-daygrid-day:not(.fc-day-other) .fc-daygrid-day-number` for the in-month
 * tone, and `.fc-day-other .fc-daygrid-day-number` for the other.
 */
const DAY_CELL_RULES = `.fc .fc-daygrid-day {
      padding: 3px 4px;
    }

    .fc .fc-daygrid-day-top {
      padding: 0;
    }

    .fc .fc-daygrid-day-number {
      padding: 0;
      font-size: var(--text-2xs);
      line-height: 1.4;
      color: var(--sv-fg-muted);
      text-decoration: none;
    }

    .fc .fc-day-other .fc-daygrid-day-number {
      color: var(--sv-fg-subtle);
    }

    .fc .fc-day-today .fc-daygrid-day-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      border-radius: 9999px;
      background-color: var(--sv-primary);
      color: var(--sv-primary-fg);
    }`

/**
 * Event chip + the "+N more" link.
 *
 * The canvas' `1px 4px` sits on the CHIP, in one declaration, and
 * FullCalendar's own inner padding is zeroed to make room for it: composing it
 * from an upstream inner padding held for block events only, never for a dot
 * event. One element, one declaration, one number to check.
 *
 * Type is `--text-2xs` (10px, the canvas' 9px has no rung) on the inner box.
 *
 * The label tone of a FILLED event (a block, or a time-grid event) is
 * re-asserted on the event ROOT from FullCalendar's own per-event
 * `--fc-event-contrast-color`. The theme paints it on an inner box only, so
 * the element a reader — or `option-colors.spec.ts`, or an accessibility
 * audit — inspects for the fill/text pair would otherwise report the fill from
 * the author and a colour inherited from the page ([internal ref] A7 ruling 3). A dot
 * event has no fill, so it keeps the page's text colour.
 *
 * An event the author styles through the calendar's `event` part is marked
 * `sv-event-part`, and its fill and ink step back to the layered utilities
 * (`revert-layer`): both sheets here are unlayered and would otherwise win.
 */
const EVENT_RULES = `.fc .fc-daygrid-event,
    .fc .fc-timegrid-event {
      border-radius: var(--radius-sm);
    }

    .fc .fc-event-main {
      font-size: var(--text-2xs);
      line-height: 1.4;
    }

    .fc .fc-daygrid-event {
      padding: 1px 4px;
      margin: 2px 0 0;
    }

    .fc .fc-daygrid-event .fc-event-main,
    .fc .fc-daygrid-event .fc-event-time,
    .fc .fc-daygrid-event .fc-event-title {
      padding: 0;
    }

    .fc .fc-daygrid-block-event,
    .fc .fc-timegrid-event {
      color: var(--fc-event-contrast-color);
    }

    .fc .fc-event-title,
    .fc .fc-event-time {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .fc .fc-daygrid-day-bottom {
      margin: 0;
      font-size: var(--text-2xs);
    }

    .fc .sv-event-part,
    .fc .sv-event-part * {
      background-color: revert-layer;
      color: revert-layer;
    }

    .fc .fc-daygrid-more-link,
    .fc .fc-timegrid-more-link {
      padding: 0 2px;
      border-radius: var(--radius-sm);
      font-size: var(--text-2xs);
      line-height: 1.4;
      background-color: transparent;
      color: var(--sv-fg-muted);
    }

    .fc .fc-daygrid-more-link:hover,
    .fc .fc-timegrid-more-link:hover {
      background-color: var(--sv-bg-subtle);
    }`

/**
 * Time-grid: gutter, slot rows, all-day row, today column.
 *
 * The 44px gutter is declared on the two cells that FORM the column (the header
 * axis and the slot labels) rather than on a wrapper, because FullCalendar
 * sizes that column from its cells; `max-width` on the cushion — which is where
 * FullCalendar's own 60px cap lives — only clips the text. The 24px slot row
 * is not here: FullCalendar 7 sizes slots in script, so it is the island's
 * `slotMinHeight` (`islands/calendar/calendar-options.ts`).
 *
 * The today COLUMN takes `ground`, not the `well` a today day-cell takes. That
 * is the canvas' intent and not an inconsistency: a full-height column tint at
 * day-cell strength would dominate the whole view, so the column reads one step
 * fainter. It has to be spelled explicitly because FullCalendar routes both
 * through the single `--fc-classic-today`.
 */
const TIME_GRID_RULES = `.fc .fc-timegrid-axis,
    .fc .fc-timegrid-slot-label {
      width: 44px;
    }

    .fc .fc-timegrid-slot-label-cushion,
    .fc .fc-timegrid-axis-cushion {
      padding: 0 4px;
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: var(--text-2xs);
      line-height: 1.4;
      color: var(--sv-fg-subtle);
    }

    .fc .fc-timegrid-axis-cushion {
      padding: 5px 4px;
    }

    .fc .fc-timegrid .fc-daygrid-day {
      border-bottom-color: var(--sv-border);
    }

    .fc .fc-timegrid .fc-daygrid-day-frame {
      min-height: 22px;
    }

    .fc .fc-timegrid-axis {
      border-bottom-color: var(--sv-border);
    }

    .fc .fc-timegrid-col.fc-day-today {
      background-color: var(--sv-bg);
    }`

/**
 * The current-time indicator.
 *
 * The line already resolves through `--fc-now-indicator-color`, so only the
 * marker at its left end needs converging: FullCalendar draws a CSS-triangle
 * arrow out of asymmetric borders, and the canvas draws a 7px dot. Zeroing the
 * border width is what dismantles the triangle; the explicit box then paints
 * the dot. `margin-top: -3px` re-centres it on the 1px line (half of 7px, less
 * the line).
 */
const NOW_INDICATOR_RULES = `.fc .fc-timegrid-now-indicator-line {
      border-width: 1px 0 0;
      border-top-color: var(--sv-error-solid);
    }

    .fc .fc-timegrid-now-indicator-arrow {
      border-width: 0;
      width: 7px;
      height: 7px;
      margin-top: -3px;
      border-radius: 9999px;
      background-color: var(--sv-error-solid);
    }`

/**
 * Generate the calendar stylesheet.
 *
 * Takes no argument, and that is the point rather than an omission: every value
 * it emits is either a fixed geometry from the canvas or an indirection into an
 * existing `--sv-*` / `--text-*` token. There is nothing to re-resolve per
 * theme, so an author override reaches the calendar without this generator
 * knowing the author exists (unlike `generateCodeBlockStyles(design)`).
 */
export function generateCalendarStyles(): string {
  return [
    '/* ── Calendar (FullCalendar) theming — wave R-D ── */',
    FC_VAR_BRIDGE,
    INNER_GRID_RULES,
    HEADER_RULES,
    DAY_CELL_RULES,
    EVENT_RULES,
    TIME_GRID_RULES,
    NOW_INDICATOR_RULES,
    CALENDAR_DAY_FLOOR_RULES,
  ].join('\n\n    ')
}
