/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The curve branch of `swatch` — the one design fact a console must DRAW
 * rather than print.
 *
 * A duration is a number and reads fine as one. A curve is a shape and does
 * not: `cubic-bezier(0.3, 0, 0.1, 1.1)` and `cubic-bezier(0.4, 0, 1, 1)` are
 * four digits apart on the page and opposite in the hand, and nobody has ever
 * chosen between them by reading them. So the drawing is the component and
 * `showValue` is the option.
 *
 * ─── THE PATH IS DERIVED, NEVER TABULATED ──────────────────────────────────
 *
 * The four control points come out of the RESOLVED value every time
 * (`resolveEasingCurve` → `bezierControlPoints`). A table of four hand-drawn
 * paths would satisfy "a curve appeared" and would go silently wrong the first
 * time an app declared an easing of its own — which is the transcription defect
 * this component exists to remove. `[internal ref]` recovers
 * the ratios back out of the emitted `d` and compares them to the token's own
 * value, so a tabulated path fails rather than passing quietly.
 *
 * ─── THE BOX IS SQUARE, AND THE OVERSHOOT IS NOT CLIPPED ───────────────────
 *
 * Both bezier ordinates are normalised progress — time across, output up — so a
 * non-square plot scales the two axes differently and shows a curve steeper
 * than the one the app runs. The distortion is invisible, which is why `size`
 * is one number rather than a width/height pair.
 *
 * A curve may legitimately leave the unit square: the platform's `emphasized`
 * peaks at `1.1`. The plot therefore renders with overflow visible, because a
 * clipped overshoot draws as a flat top — the drawing then claims the curve
 * settles where it in fact rebounds.
 *
 * Source: src/domain/models/app/pages/components/component-types/display/swatch.ts
 * Specs: [internal ref]
 */

import {
  bezierControlPoints,
  resolvableEasingCurves,
  resolveEasingCurve,
} from '@/domain/models/app/design/easing-curve'
import { omitInternalMarkers } from '../props/internal-marker-props'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Edge of the plot when the author names no size, in CSS pixels.
 *
 * Large enough that the difference between two curves is visible at a glance,
 * small enough that a motion section drawing four of them stays one screen.
 */
const DEFAULT_PLOT_SIZE = 120

/**
 * Coordinates are emitted at three decimals.
 *
 * The spec recovers each ratio by normalising against the path's OWN endpoints
 * and compares to two decimals, so the rounding here has to be finer than the
 * assertion by a clear margin — and the emitted `d` still has to read as a
 * number rather than as exponent notation, which `toFixed` guarantees and
 * `String(0.0000001)` does not.
 */
const coordinate = (value: number): string => Number(value.toFixed(3)).toString()

/** Read one field off the component definition, when it is a string. */
const text = (component: Component | undefined, key: string): string | undefined => {
  const value = (component as Record<string, unknown> | undefined)?.[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * The cubic path for one curve, plotted in a `size`-edge square.
 *
 * `M 0 size C … size 0` — the curve starts at the origin (no time elapsed, no
 * progress made) and ends at the far corner, with y inverted because SVG grows
 * downward while an easing plot grows upward.
 */
const curvePath = (points: readonly number[], size: number): string => {
  const [x1, y1, x2, y2] = points
  const across = (ratio: number | undefined): string => coordinate((ratio ?? 0) * size)
  const up = (ratio: number | undefined): string => coordinate(size - (ratio ?? 0) * size)
  return `M ${coordinate(0)} ${coordinate(size)} C ${across(x1)} ${up(y1)} ${across(x2)} ${up(y2)} ${coordinate(size)} ${coordinate(0)}`
}

/** Everything the plot needs, read off the declaration in one place. */
interface ResolvedPlot {
  readonly token: string
  readonly label: string
  readonly size: number
  readonly showValue: boolean
  readonly value: string | undefined
  readonly points: readonly number[] | undefined
}

/** Read one declaration against the app's curve table. */
const readPlot = (component: Component | undefined, motion: unknown): ResolvedPlot => {
  const token = text(component, 'token') ?? ''
  const value = resolveEasingCurve(token, resolvableEasingCurves(motion))
  const rawSize = (component as { size?: unknown } | undefined)?.size
  return {
    token,
    label: text(component, 'label') ?? token,
    size: typeof rawSize === 'number' && rawSize > 0 ? rawSize : DEFAULT_PLOT_SIZE,
    showValue: (component as { showValue?: unknown } | undefined)?.showValue === true,
    value,
    points: value === undefined ? undefined : bezierControlPoints(value),
  }
}

/**
 * `easing-curve` — one easing token, drawn.
 *
 * A token that resolves to nothing draws nothing: the config is refused at
 * boot, so reaching this branch means the design changed under a rendered page,
 * and an invented curve would be worse than an empty frame.
 */
export const easingCurveComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  component,
  design,
}) => {
  const { token, label, size, showValue, value, points } = readPlot(component, design?.motion)

  return (
    <figure
      {...omitInternalMarkers(elementPropsWithSpacing)}
      data-easing-token={token}
    >
      {points === undefined ? undefined : (
        <svg
          role="img"
          aria-label={`Easing curve ${label}`}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
          data-easing-plot=""
        >
          {/* The linear reference the curve is read against. A `line` and not a
              path, so the spec's `path[d*="C"]` locator cannot pick it up. */}
          <line
            x1={0}
            y1={size}
            x2={size}
            y2={0}
            stroke="var(--sv-border, #e5e5e5)"
            strokeDasharray="4 4"
          />
          <path
            d={curvePath(points, size)}
            fill="none"
            stroke="var(--sv-primary, currentColor)"
            strokeWidth={2}
          />
        </svg>
      )}
      <figcaption>
        <span data-easing-label="">{label}</span>
        {showValue && value !== undefined ? <code data-easing-value="">{value}</code> : undefined}
      </figcaption>
    </figure>
  )
}
