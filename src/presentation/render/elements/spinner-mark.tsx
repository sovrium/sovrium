/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The house spinner mark: one open arc, drawn once.
 *
 * It used to be the stock two-part spinner — a 4px ring at 25% opacity with a
 * filled quarter-wedge riding over it — which is a heavier mark than anything
 * else the system draws and reads as a solid disc at 16px. The reference draws
 * a spinner as a single stroked arc, which is why this one is a `path` and not
 * a `circle` plus a fill.
 *
 * 2.5 is the one stroke weight in the product that is not 1.5, deliberately: a
 * spinner is read as MOTION rather than as a glyph, and at icon weight the arc
 * disappears while it turns.
 *
 * ─── WHY IT LIVES HERE RATHER THAN IN `button-renderer.tsx` ────────────────
 *
 * It was a module constant inside the button renderer until the `spinner`
 * component type gained a renderer of its own, at which point the product
 * would have owned two spinner marks that had to be kept looking alike by
 * hand. Both consumers are in the render tree — `button-renderer.tsx` and
 * `registry/structural-components.tsx` — so a shared element is the one home
 * they can both reach without either importing the other.
 *
 * ─── THE 16px ATTRIBUTES ARE A FLOOR, NOT THE SIZE ─────────────────────────
 *
 * `width` / `height` stay on the `<svg>` as the intrinsic fallback: an SVG
 * with neither and no stylesheet would lay out at 300x150, and the button
 * draws this mark inline beside its label where that would be catastrophic.
 * They are presentation attributes, so ANY CSS rule beats them — which is how
 * the `spinner` component scales: it passes `size-full` and the mark fills
 * whatever box the author sized, while the button passes nothing and keeps
 * the 16px it has always drawn., written
 * precisely because reusing a mark pinned at 16 would paint a three-rung size
 * ladder identically.
 */

import { resolveClasses } from '@/presentation/design/resolve-classes'
import type { ReactElement } from 'react'

/**
 * Render the spinner mark.
 *
 * @param className - Extra classes for the `<svg>`, resolved against
 *   `animate-spin` so a caller wins any same-property conflict. Omit it to
 *   draw the 16px mark the button uses; pass `size-full` (or any `size-*`) to
 *   let the mark take its size from the box around it.
 */
export function renderSpinnerMark(className?: string): ReactElement {
  return (
    <svg
      key="spinner-mark"
      className={resolveClasses('animate-spin', undefined, className)}
      data-loading="true"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 1-6.4 2.6" />
    </svg>
  )
}
