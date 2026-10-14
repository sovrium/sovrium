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
 * layout / spacing classes stay as raw Tailwind utilities; colours are the
 * shadcn role utilities (`bg-card`, `border-ring`), and radius / shadow go
 * through {@link withVarFallback} so `app.design.*` overrides still win at the
 * CSS cascade layer (the variable first, the inline literal as its fallback).
 *
 * The calendar inside the popup is the shared react-day-picker wrapper
 * (`islands/parts/day-picker.tsx`), which carries its own classes; this file
 * styles only what surrounds it: `date-picker-island.tsx` (trigger + hydration
 * plumbing) and `date-picker-popup.tsx` (the popup). One island handles both
 * `single` and `range` selection modes via the `datePickerMode` schema prop —
 * Sovrium does NOT ship separate datetime or time-only variants under the
 * `ui-kit-date` cluster (the `time-picker` schema lives in `specialty/` and
 * renders as a native `<input type="time">`, outside this slice).
 *
 * Subparts covered:
 *   - TRIGGER       — closed-state button that opens the popup (re-exported
 *                     from `design/date-trigger-default-classes.ts`)
 *   - POPUP         — floating `<div role="dialog">` panel with elevation
 *
 * Helper file lives in `src/presentation/islands/` (alongside the islands that
 * consume it) because the date-picker hydrates entirely client-side via the
 * island registry — the `presentation-component → presentation-island` layer
 * boundary disallows island imports from `ui/sections/`. Mirrors the location
 * chosen for `select-default-classes.ts` and `toggle-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { POPUP_SURFACE } from '../../design/shared-tokens-default-classes'

/**
 * The TRIGGER recipe lives in `design/date-trigger-default-classes.ts`, because
 * the server-rendered placeholder paints from it too and the SSR tree cannot
 * import an island. Re-exported here so the islands keep one import site.
 */
export { computeDateTriggerClasses } from '@/presentation/design/date-trigger-default-classes'

const RADIUS_LG = `rounded-[${v('radius-lg', T.radiusLg)}]`

// ──────────────────────────────────────────────────────────────────────────────
// POPUP (floating calendar dialog)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The popup's box.
 *
 * `max-w-[calc(100vw-2rem)]` is a floor under every calendar popup rather
 * than a fix for one: the panel is absolutely positioned, so nothing in the
 * document constrains its width, and a two-calendar range panel measured 562px
 * against a 375px viewport — drawn, clipped, and unreachable, with the page
 * refusing to scroll sideways to it. The cap leaves a 1rem margin on each side
 * so the panel reads as a floating layer rather than a full-bleed sheet.
 *
 * It is a LAST resort, not the mechanism: a panel whose contents still want
 * more than the cap allows is clipped by it. The contents adapt first — see
 * `range-panel.tsx`, which stacks its preset column and hides its second month
 * below `md` so the cap is never the thing doing the work.
 */
const POPUP_LAYOUT = 'absolute left-0 top-full z-50 mt-1 max-w-[calc(100vw-2rem)] p-1'

/**
 * The same panel, drawn IN FLOW — the layout a still DEPICTION of the open
 * state needs.
 *
 * `absolute left-0 top-full z-50` is what makes the live popup float over the
 * page from its trigger, and it is the one part of the panel a document cannot
 * keep: a specimen strip lays its cells out side by side, so an absolutely
 * positioned calendar would lift out of its own cell and cover its neighbours.
 * Everything else — the radius, the surface, the shadow, the padding — is the
 * component's own, which is what keeps the drawing the component rather than a
 * picture of it.
 *
 * This is the layout half of why `open` is filed as `depicted` rather than
 * `rendered`: the appearance is real markup and the POSITION is the console's.
 */
const POPUP_LAYOUT_DEPICTED = 'relative mt-1 max-w-[calc(100vw-2rem)] p-1'

const POPUP_SHADOW = `shadow-[${v('shadow-lg', T.shadowLg)}]`

/**
 * Compute the default className for the calendar popup `<div role="dialog">`
 * — the floating panel that hosts the month navigation row and the day grid.
 * Uses the bg-overlay surface so it reads as a clearly-detached floating
 * layer above the trigger; shadow-lg lifts it above background content with
 * enough contrast to be obvious in dark mode too.
 */
export const computeDatePopupClasses = ({
  depicted = false,
}: {
  depicted?: boolean
} = {}): string =>
  [depicted ? POPUP_LAYOUT_DEPICTED : POPUP_LAYOUT, RADIUS_LG, POPUP_SURFACE, POPUP_SHADOW].join(
    ' '
  )
