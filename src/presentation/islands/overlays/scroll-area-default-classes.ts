/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the scroll-area island
 *. The Base UI ScrollArea primitive ships with custom-styled
 * scrollbars that appear on hover; this helper paints the bar track + thumb
 * through the var-with-fallback recipe so `app.theme.*` overrides still win
 * (the previous inline `bg-border-strong` alias only resolved when the
 * theme layer was loaded).
 *
 * Subparts covered:
 *
 *   - SCROLLBAR  — outer `<ScrollArea.Scrollbar>` track. The `orientation`
 *                  axis flips between the vertical (`w-2 flex`) and
 *                  horizontal (`h-2 flex`) layouts. Opacity drops to 0 by
 *                  default and rises to 1 on hover / scroll via Base UI's
 *                  `data-[hovering]` + `data-[scrolling]` data-state
 *                  attributes. Color stays as raw `transition-opacity` —
 *                  the track itself is transparent; only the thumb (below)
 *                  carries a bg color.
 *   - THUMB      — `<ScrollArea.Thumb>` inside the scrollbar. Pure surface
 *                  chrome: rounded pill on the border-strong tone so the
 *                  thumb reads as a definite affordance against any page
 *                  background. `flex-1` lets Base UI compute the thumb
 *                  length from the viewport / content ratio.
 *
 * Helper file lives in `src/presentation/islands/` (alongside
 * `scroll-area-island.tsx` that consumes it) because the ScrollArea
 * primitive is client-only — the `presentation-component →
 * presentation-island` layer boundary disallows island imports from
 * `ui/sections/`. Mirrors the location chosen for
 * `disclosure-default-classes.ts`, `select-default-classes.ts`,
 * `toggle-default-classes.ts`, `numeric-default-classes.ts`,
 * `date-default-classes.ts`, and `overlay-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

/**
 * Scrollbar orientation axis (matches Base UI's `orientation` prop):
 *   - `'vertical'`   — scrolls up/down (`w-2` + column layout)
 *   - `'horizontal'` — scrolls left/right (`h-2` + row layout)
 */
export type ScrollAreaOrientation = 'vertical' | 'horizontal'

const SCROLLBAR_BASE =
  'flex touch-none p-0.5 opacity-0 transition-opacity hover:opacity-100 data-[hovering]:opacity-100 data-[scrolling]:opacity-100'

/**
 * Compute the default className for a `<ScrollArea.Scrollbar>` track. The
 * `orientation` axis only flips the dimension axis (`w-2` for vertical,
 * `h-2` for horizontal); the visibility / motion behavior stays the same
 * — Base UI's `data-[hovering]` / `data-[scrolling]` attributes drive the
 * fade-in via `transition-opacity`.
 *
 * No color classes on the track itself — the scrollbar is transparent so
 * the thumb (which IS painted) reads cleanly against any underlying
 * content. The track only serves as the hit-target boundary.
 */
export const computeScrollAreaScrollbarClasses = ({
  orientation,
}: {
  readonly orientation: ScrollAreaOrientation
}): string => [SCROLLBAR_BASE, orientation === 'vertical' ? 'w-2' : 'h-2'].join(' ')

const SCROLLBAR_THUMB = [
  'flex-1',
  `bg-[${v('sv-border-strong', T.borderStrong)}]`,
  `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
].join(' ')

/**
 * Compute the default className for the `<ScrollArea.Thumb>` inside the
 * scrollbar track. `flex-1` lets Base UI size the thumb proportional to
 * the viewport / content ratio. `border-strong` tone (a step darker than
 * the standard border) so the thumb reads as a deliberate affordance
 * rather than dissolving into the page chrome. `rounded-full` pill shape
 * matches the conventional custom-scrollbar idiom.
 *
 * Replaces the previously inline `bg-border-strong` alias on
 * `<ScrollArea.Thumb>` so the thumb tone now flows through the
 * `--sv-border-strong` var-fallback registration — tenants who override
 * `app.theme.colors.border` see the thumb shift with the rest of the
 * theme chrome.
 */
export const computeScrollAreaThumbClasses = (): string => SCROLLBAR_THUMB
