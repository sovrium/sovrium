/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the `date-picker` component
 *.
 *
 * Schema authors who write the bare `{ type: 'date-picker' }` (or
 * `{ type: 'date-picker', datePickerMode: 'range' }`) get a complete,
 * opinionated control — bordered closed-state trigger with focus-visible ring,
 * elevated calendar popup with month navigation, weekday header, and day-cell
 * grid that lights up selected dates in primary tone — with zero theme-layer
 * dependency.
 *
 * The recipe mirrors the buttons + inputs + selects + toggles + numeric slices
 * (commits 02b2f35f3 + 571ae53ce + 5527660bc + 000f835d7 + 386e9dc35):
 * layout / spacing classes stay as raw Tailwind utilities; only color /
 * radius / shadow / motion / focus classes go through {@link withVarFallback}
 * so `app.theme.*` overrides still win at the CSS cascade layer (var lookups
 * resolve `--sv-*` first, fall back to the inline OKLCH literal).
 *
 * Sovrium's date-picker is a CUSTOM popover-anchored calendar (not
 * `react-day-picker`). It owns its grid structure (`<table role="grid">` with
 * one `<button>` per day) split across `date-picker-island.tsx` (trigger +
 * hydration plumbing), `date-picker-popup.tsx` (popup chrome + month nav),
 * and `date-grid.tsx` (the 7-column day matrix). One island handles both
 * `single` and `range` selection modes via the `datePickerMode` schema prop —
 * Sovrium does NOT ship separate datetime or time-only variants under the
 * `ui-kit-date` cluster (the `time-picker` schema lives in `specialty/` and
 * renders as a native `<input type="time">`, outside this slice).
 *
 * Subparts covered (matches the existing DOM layering):
 *   - TRIGGER       — closed-state button that opens the popup
 *   - POPUP         — floating `<div role="dialog">` panel with elevation
 *   - NAV BUTTON    — prev/next month chevrons (direction-aware aria-label)
 *   - CAPTION       — current month/year label
 *   - WEEKDAY CELL  — Su/Mo/Tu/... header column
 *   - DAY CELL      — individual day button inside the grid; state axis
 *                     `default | selected | today | outside | disabled |
 *                      range-start | range-end | range-middle`
 *
 * Helper file lives in `src/presentation/islands/` (alongside the islands that
 * consume it) because the date-picker hydrates entirely client-side via the
 * island registry — the `presentation-component → presentation-island` layer
 * boundary disallows island imports from `ui/sections/`. Mirrors the location
 * chosen for `select-default-classes.ts`, `toggle-default-classes.ts`, and
 * `numeric-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import {
  FOCUS_VISIBLE_RING,
  MOTION_COLORS,
  POPUP_SURFACE,
  RADIUS_MD,
} from '../recipes/shared-tokens-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

type TriggerState = 'default' | 'open' | 'disabled'
type NavDirection = 'previous' | 'next'
type DayCellState =
  | 'default'
  | 'selected'
  | 'today'
  | 'outside'
  | 'disabled'
  | 'range-start'
  | 'range-end'
  | 'range-middle'

const RADIUS_LG = `rounded-[${v('sv-radius-lg', T.radiusLg)}]`

const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-50'

// ──────────────────────────────────────────────────────────────────────────────
// TRIGGER (closed-state button that opens the popup)
// ──────────────────────────────────────────────────────────────────────────────

const TRIGGER_LAYOUT =
  'inline-flex items-center justify-between gap-2 px-3 py-2 text-sm w-full min-w-[12rem]'

const TRIGGER_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const TRIGGER_SHADOW = `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`

const TRIGGER_OPEN = [
  `aria-expanded:border-[${v('sv-focus-ring', T.focusRing)}]`,
  `aria-expanded:ring-1`,
  `aria-expanded:ring-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

const TRIGGER_MOTION = 'transition-[box-shadow,border-color,background-color] duration-150'

/**
 * Compute the default className for the closed-state date-picker trigger
 * button — the `aria-haspopup="dialog"` control that opens the calendar
 * popup. Mirrors the select trigger shape (bordered raised surface, focus
 * ring, elevation-xs) so a row of date-pickers and selects reads as one
 * cohesive form. Open state lights up the border via the `aria-expanded`
 * attribute that the island already wires.
 *
 * The `state` parameter is reserved for forward compatibility — current Base
 * UI plumbing exposes open / disabled via `aria-expanded` and `:disabled`
 * directly, so the recipe handles those branches without an explicit branch
 * at call time.
 */
export const computeDateTriggerClasses = ({
  state = 'default',
}: {
  state?: TriggerState
} = {}): string =>
  [
    TRIGGER_LAYOUT,
    RADIUS_MD,
    TRIGGER_SURFACE,
    TRIGGER_SHADOW,
    TRIGGER_MOTION,
    FOCUS_VISIBLE_RING,
    TRIGGER_OPEN,
    DISABLED,
    state === 'disabled' ? 'cursor-not-allowed opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// POPUP (floating calendar dialog)
// ──────────────────────────────────────────────────────────────────────────────

const POPUP_LAYOUT = 'absolute left-0 top-full z-50 mt-1 p-3'

const POPUP_SHADOW = `shadow-[${v('sv-shadow-lg', T.shadowLg)}]`

/**
 * Compute the default className for the calendar popup `<div role="dialog">`
 * — the floating panel that hosts the month navigation row and the day grid.
 * Uses the bg-overlay surface so it reads as a clearly-detached floating
 * layer above the trigger; shadow-lg lifts it above background content with
 * enough contrast to be obvious in dark mode too.
 */
export const computeDatePopupClasses = (): string =>
  [POPUP_LAYOUT, RADIUS_LG, POPUP_SURFACE, POPUP_SHADOW].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// NAV BUTTON (prev / next month chevrons)
// ──────────────────────────────────────────────────────────────────────────────

const NAV_BUTTON_LAYOUT = 'inline-flex h-7 w-7 items-center justify-center text-sm'

const NAV_BUTTON_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
].join(' ')

/**
 * Compute the default className for a calendar-popup month-navigation button
 * (the `‹` / `›` controls flanking the caption). Both directions share the
 * same recipe; the `direction` parameter is accepted for forward
 * compatibility (e.g. to tighten one side's border-radius for a date-range
 * picker that hosts two stacked grids — not the current Sovrium layout).
 * Hover lights up with the bg-subtle surface, matching the select item
 * highlight tone so navigation feels like one design vocabulary.
 */
export const computeDateNavButtonClasses = ({
  direction: _direction,
}: {
  direction: NavDirection
}): string =>
  [NAV_BUTTON_LAYOUT, RADIUS_MD, NAV_BUTTON_SURFACE, MOTION_COLORS, FOCUS_VISIBLE_RING, DISABLED]
    .filter(Boolean)
    .join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// CAPTION (current month / year label)
// ──────────────────────────────────────────────────────────────────────────────

const CAPTION_LAYOUT = 'text-sm font-medium'

const CAPTION_SURFACE = `text-[${v('sv-fg', T.fg)}]`

/**
 * Compute the default className for the calendar caption (the centred
 * "Month Year" label between the prev/next nav buttons). Uses the strong
 * foreground tone so it anchors visually against the muted weekday header
 * row below it.
 */
export const computeDateCaptionClasses = (): string => [CAPTION_LAYOUT, CAPTION_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// WEEKDAY HEADER CELL (Su Mo Tu We Th Fr Sa)
// ──────────────────────────────────────────────────────────────────────────────

const WEEKDAY_LAYOUT = 'h-8 w-8 px-1 py-1 text-center text-xs font-normal'

const WEEKDAY_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for a weekday header cell (the `<th>`
 * column heading inside the calendar `<thead>`). Muted foreground tone +
 * smaller size so the header reads as orientation, not as selectable
 * content — the eye is drawn to the strong day-cell numbers below.
 */
export const computeDateWeekdayClasses = (): string => [WEEKDAY_LAYOUT, WEEKDAY_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// DAY CELL (individual day button inside the grid)
// ──────────────────────────────────────────────────────────────────────────────

const DAY_LAYOUT = 'inline-flex h-8 w-8 items-center justify-center text-sm'

const DAY_DEFAULT = [
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const DAY_SELECTED = [
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
  `hover:bg-[${v('sv-primary-hover', T.primaryHover)}]`,
].join(' ')

const DAY_TODAY = [
  `text-[${v('sv-fg', T.fg)}]`,
  `font-semibold`,
  `ring-1`,
  `ring-[${v('sv-border-strong', T.borderStrong)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const DAY_OUTSIDE = [
  `text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const DAY_DISABLED = [`text-[${v('sv-fg-disabled', T.fgDisabled)}]`, 'cursor-not-allowed'].join(' ')

const DAY_RANGE_MIDDLE = [
  `bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
  'rounded-none',
].join(' ')

const DAY_RANGE_START = [
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
].join(' ')

const DAY_RANGE_END = DAY_RANGE_START

const DAY_STATE_MAP: Record<DayCellState, string> = {
  default: DAY_DEFAULT,
  selected: DAY_SELECTED,
  today: DAY_TODAY,
  outside: DAY_OUTSIDE,
  disabled: DAY_DISABLED,
  'range-start': DAY_RANGE_START,
  'range-end': DAY_RANGE_END,
  'range-middle': DAY_RANGE_MIDDLE,
}

/**
 * Compute the default className for an individual day-cell `<button>` inside
 * the calendar grid. The `state` axis covers every variant the day cell can
 * enter: `default` (unselected weekday in the current month), `selected`
 * (single-mode picked day), `today` (current date with a subtle ring),
 * `outside` (back-fill from previous/next month, muted), `disabled`
 * (out-of-bounds via minDate/maxDate), plus the three range-selection
 * variants. Radius defaults to md; range-middle drops it so consecutive
 * middle cells fuse into a continuous selection bar.
 */
export const computeDateDayClasses = ({
  state = 'default',
}: {
  state?: DayCellState
} = {}): string =>
  [
    DAY_LAYOUT,
    state === 'range-middle' ? '' : RADIUS_MD,
    DAY_STATE_MAP[state],
    MOTION_COLORS,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ]
    .filter(Boolean)
    .join(' ')
