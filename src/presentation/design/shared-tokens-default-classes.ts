/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared default-class composites for the island `*-default-classes.ts` files.
 *
 * Several islands independently re-declared the SAME var-with-fallback class
 * strings (`rounded-[…radius-md…]`, the focus-visible ring stack, the
 * `transition-colors duration-150` motion pair, the overlay popup surface).
 * Promoting the genuinely-identical ones to one module removes the drift risk
 * (a token rename in `css-var.ts` now updates every island at once) without
 * changing any emitted class string.
 *
 * Only the byte-for-byte identical composites live here. Island-specific
 * variants (e.g. the select popup surface that omits `text-fg`, or the field
 * color-picker surface that adds `shadow-lg`) stay local to their file.
 *
 * NOTE: this file is intentionally named `*-default-classes.ts` so the Tailwind
 * arbitrary-value safelist scanner (`src/infrastructure/css/arbitrary-var-safelist.ts`,
 * which globs `*-default-classes.ts` in this directory) keeps emitting the
 * `var(--sv-*,…)` arbitrary classes declared below — exactly as it did when the
 * composites lived in each island file.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

/**
 * `base` corner radius — the CONTROL step: a button, a field, a menu item, a
 * tooltip chip. The smallest working step in the scale.
 */
export const RADIUS_BASE = `rounded-[${v('radius-base', T.radiusBase)}]`

/**
 * `md` corner radius — the POPUP step: a menu, a popover, a dialog, a drawer.
 * Was re-declared in 6 island files.
 */
export const RADIUS_MD = `rounded-[${v('radius-md', T.radiusMd)}]`

/**
 * Keyboard focus ring (outline-none + 2px ring + 2px offset, themed colors).
 * Was re-declared in 3 island files.
 */
export const FOCUS_VISIBLE_RING = [
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-visible:ring-offset-[${v('sv-bg', T.bg)}]`,
].join(' ')

/**
 * The standard color transition for interactive surfaces. Was re-declared in 4
 * island files (3 as `MOTION_COLORS`, 1 as `MOTION`).
 */
export const MOTION_COLORS = 'transition-colors duration-150'

/**
 * Overlay popup surface: themed border + overlay background + foreground text.
 * Was re-declared identically in the date + overlay islands. (The select and
 * field variants differ — see their local declarations.)
 */
export const POPUP_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-overlay', T.bgOverlay)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')
