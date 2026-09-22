/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * FullCalendar theming stylesheet (wave R-D, the `calendar` data view).
 *
 * FullCalendar receives NO Sovrium tokens without this file: it self-injects
 * its own stylesheet from JS, nothing imports a `.fc` stylesheet anywhere, and
 * before this module `grep -rn -- "--fc-" src/ apps/` returned nothing. So a
 * calendar rendered against a tenant's `app.design` still painted
 * FullCalendar's factory greys and its `#3788d8` event blue.
 *
 * The block is PLAIN CSS composed into `buildSourceCSS`
 * (`infrastructure/css/compiler.ts`) beside `generateCodeBlockStyles` and
 * `generateMarqueeStyles`, for exactly the two reasons those two are there:
 *
 *  - **It flows through BOTH compile engines.** `buildSourceCSS` is the shared
 *    input for the native PostCSS path and the pure-JS native-free engine the
 *    compiled binary runs, so a rule written here needs no Tailwind candidate
 *    scan to reach the served stylesheet.
 *  - **Tailwind cannot express it.** `.fc-daygrid-day` is not utility-shaped.
 *    The compiler is candidate-driven rather than source-scanning, so a
 *    `.fc-*` selector could never be minted as a utility — it would have to be
 *    hand-added to the corpus and would still not be a class we control,
 *    because FullCalendar puts it on the DOM, not us.
 *
 * ## Why theming rather than replacing
 *
 * FullCalendar's own DOM is a spec contract: `.fc-event`, `.fc-daygrid-day`,
 * `.fc-event-draggable` and `[data-date]` are selected by four spec files
 * (`data-calendar.spec.ts`, `data-calendar/system-read-endpoint-data-source.spec.ts`,
 * `runtime-views/view-type-switcher-renders-selected-view.spec.ts`,
 * `data-table/option-colors.spec.ts`). So the grid STAYS and is themed from the
 * outside. Only the toolbar is replaced — with Sovrium markup driven by
 * `calendar-default-classes.ts` — because nothing in `[internal ref]` touches
 * `.fc-toolbar` or FullCalendar's own buttons.
 *
 * ## Two rule weights, deliberately — the single most visible calendar error
 *
 * The canvas uses `hair` (`--sv-border`) for the OUTER separators — under the
 * weekday header, under the all-day row, and the scrollgrid frame — and `well`
 * (`--sv-bg-subtle`, much fainter) for the INNER grid rules between cells.
 * Collapsing them into one weight is what makes a themed calendar still read as
 * unthemed: every line the same weight is the FullCalendar default look.
 *
 * FullCalendar draws every cell edge from ONE variable
 * (`.fc-theme-standard td,.fc-theme-standard th{border:1px solid var(--fc-border-color)}`),
 * so the split cannot come from the variable bridge. `--fc-border-color` is
 * bound to `hair` — the outer weight — and the inner parts are then walked back
 * to `well` by explicit rules below.
 *
 * ## How these rules win, given FullCalendar injects at runtime
 *
 * Two independent mechanisms, and both were verified against the installed
 * package rather than assumed:
 *
 *  1. **The variable bridge wins by PROXIMITY, not specificity.** FullCalendar
 *     declares its defaults on `:root`
 *     (`@fullcalendar/core/internal-common.js`, `css_248z`). Custom properties
 *     inherit, so a redeclaration on `.fc` — the calendar root — is the nearer
 *     ancestor for everything inside it and wins regardless of order. It also
 *     leaks nothing: outside `.fc` the `:root` defaults still stand, unused.
 *  2. **The geometry rules win by ORDER at equal-or-higher specificity.**
 *     `registerStylesRoot` inserts FullCalendar's `<style data-fullcalendar>`
 *     *before* the first `script,link[rel=stylesheet],link[as=style],style` in
 *     `<head>`, so the compiled Sovrium stylesheet always follows it. Every
 *     selector below is written `.fc <part>` (0,2,0 or better) so it also beats
 *     FullCalendar's element-qualified `.fc-theme-standard td` (0,1,1)
 *     outright. Both sheets are UNLAYERED — these rules are emitted at
 *     `buildSourceCSS` top level, not inside an `@layer` — so no cascade-layer
 *     ordering enters into it.
 *
 * ## What this file deliberately does NOT paint
 *
 *  - **Event FILL and event TEXT COLOUR.** `option-colors.spec.ts` reads the
 *    computed `background-color` / `color` off `.fc-event` and asserts an AA
 *    contrast pair derived from the author's declared option colour. Those come
 *    from the island's per-event `backgroundColor` / `textColor`, and a rule
 *    here would silently outrank them. Only the BOX (radius, padding, type,
 *    ellipsis) is converged.
 *  - **The event border.** Same spec reads `borderTopColor` on chip-shaped
 *    surfaces; FullCalendar draws the border in the event's own colour, so it
 *    is invisible anyway and removing it buys nothing but risk.
 *  - **The tinted-vs-filled event variants.** The canvas draws a `well` fill
 *    with a 2px series-hue left rule for a "tinted" event and a solid hue for a
 *    "filled" one. Which of the two an event gets is a DATA decision made in
 *    `record-to-event.ts`, not a CSS one; converging it is a separate change.
 */

/**
 * The `--fc-*` → `--sv-*` bridge, scoped to the calendar root.
 *
 * Every value is an indirection into an existing `--sv-*` token, so the block
 * needs no author input and no schema surface — and a tenant's `app.design`
 * override follows for free, because the override rebinds the `--sv-*` the
 * bridge points at.
 *
 * No fallback literal is spelled here (unlike an island recipe's
 * `var(--sv-x, <oklch>)`) precisely because the fallback already exists: if a
 * `--sv-*` were somehow unresolved, `var()` falls through to FullCalendar's own
 * `:root` default rather than to `unset`, which is the correct degrade.
 */
const FC_VAR_BRIDGE = `.fc {
      --fc-border-color: var(--sv-border);
      --fc-page-bg-color: var(--sv-bg-raised);
      --fc-neutral-bg-color: var(--sv-bg-subtle);
      --fc-neutral-text-color: var(--sv-fg-muted);
      --fc-today-bg-color: var(--sv-bg-subtle);
      --fc-event-bg-color: var(--sv-chart-1);
      --fc-event-border-color: var(--sv-chart-1);
      --fc-event-text-color: var(--sv-fg-inverse);
      --fc-now-indicator-color: var(--sv-error-solid);
      --fc-list-event-hover-bg-color: var(--sv-bg-subtle);
      --fc-highlight-color: var(--sv-bg-subtle);
      --fc-small-font-size: var(--text-xs);
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
 * The 36px minimum and the 3px/4px inset live on the FRAME rather than on the
 * `<td>`, because the frame is the flex box FullCalendar lays the number and
 * the event stack inside; padding on the `<td>` would sit outside the cell's
 * own background and the today tint would stop short of it.
 *
 * The day number's own 4px padding is therefore zeroed — it would otherwise
 * compound with the frame inset — and the horizontal event margins with it, so
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
const DAY_CELL_RULES = `.fc .fc-daygrid-day-frame {
      min-height: 36px;
      padding: 3px 4px;
    }

    .fc .fc-daygrid-day-number {
      padding: 0;
      font-size: var(--text-2xs);
      line-height: 1.4;
      color: var(--sv-fg-muted);
      text-decoration: none;
    }

    .fc .fc-day-other .fc-daygrid-day-top {
      opacity: 1;
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
 * FullCalendar's own inner padding is zeroed to make room for it. The first
 * attempt here instead wrote `0 3px` on the chip and left
 * `.fc-daygrid-block-event .fc-event-title{padding:1px}` standing, reasoning
 * that the two compose to 1px/4px. They do — but only for a BLOCK event, and
 * only for as long as that upstream rule keeps saying `1px`. A dot event
 * (`.fc-daygrid-dot-event{padding:2px 0}`) carries no inner padding at all and
 * would have come out `0 3px`, and no single element ever reported the figure
 * the canvas specifies, so the inset was unverifiable in a browser. Live
 * measurement duly read `0px 3px` and flagged it. One element, one declaration,
 * one number to check.
 *
 * Type is `--text-2xs` (10px) where the canvas draws 9px: 9 has no rung on the
 * platform ladder, and inventing one for a calendar chip would put a step in
 * the type scale that only this surface uses. +1px, recorded.
 */
const EVENT_RULES = `.fc .fc-daygrid-event,
    .fc .fc-timegrid-event {
      border-radius: var(--radius-sm);
      font-size: var(--text-2xs);
      line-height: 1.4;
    }

    .fc .fc-daygrid-event {
      padding: 1px 4px;
      margin-top: 2px;
    }

    .fc .fc-daygrid-block-event .fc-event-time,
    .fc .fc-daygrid-block-event .fc-event-title {
      padding: 0;
    }

    .fc-direction-ltr .fc-daygrid-event.fc-event-start,
    .fc-direction-ltr .fc-daygrid-event.fc-event-end,
    .fc-direction-rtl .fc-daygrid-event.fc-event-start,
    .fc-direction-rtl .fc-daygrid-event.fc-event-end {
      margin-left: 0;
      margin-right: 0;
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
 * FullCalendar's own 60px cap lives — only clips the text.
 *
 * The today COLUMN takes `ground`, not the `well` a today day-cell takes. That
 * is the canvas' intent and not an inconsistency: a full-height column tint at
 * day-cell strength would dominate the whole view, so the column reads one step
 * fainter. It has to be spelled explicitly because FullCalendar routes both
 * through the single `--fc-today-bg-color`.
 */
const TIME_GRID_RULES = `.fc .fc-timegrid-axis,
    .fc .fc-timegrid-slot-label {
      width: 44px;
    }

    .fc .fc-timegrid-slot {
      height: 24px;
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
 * knowing the author exists. Mirrors `generateMarqueeStyles()`; contrast
 * `generateCodeBlockStyles(design)`, which genuinely branches on
 * `design.codeBlock.theme`.
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
  ].join('\n\n    ')
}
