/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SSR renderer for the `progress` page component
 *.
 *
 * Renders an accessible progress indicator with `role="progressbar"` and
 * the `aria-valuenow` / `aria-valuemin` / `aria-valuemax` attributes screen
 * readers expect. Two variants:
 *  - `linear` (default): a horizontal bar whose fill width is the percentage;
 *    `size` (sm/md/lg) controls the bar height so thinner/thicker bars are
 *    visually and dimensionally distinct.
 *  - `circle`: an SVG ring whose stroke dash offset encodes the percentage.
 *
 * `showLabel` renders the rounded percentage (`75%`) — centred for the circle
 * variant, inline beside the bar for the linear variant. The author-declared
 * `props.id` is placed on the progressbar element so layout assertions can
 * resolve it via `#id`, and `props.label` becomes the `aria-label`.
 *
 * This is a pure SSR component (no interactivity), so no island is required.
 */

import {
  computeProgressBarClasses,
  computeProgressCircleBarStroke,
  computeProgressCircleTrackStroke,
  computeProgressLabelClasses,
  computeProgressTrackClasses,
} from '../../renderers/element-renderers/recipes/feedback-default-classes'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

/** Default maximum when `progressMax` is unset. */
const DEFAULT_MAX = 100

/** Bar heights (px) per size token — `sm` thinner than `md` thinner than `lg`. */
const BAR_HEIGHT_PX: Readonly<Record<string, number>> = { sm: 4, md: 8, lg: 12 }

/** Circle pixel diameters per size token. */
const CIRCLE_SIZE_PX: Readonly<Record<string, number>> = { sm: 48, md: 72, lg: 96 }

interface ProgressFields {
  readonly value: number
  readonly max: number
  readonly percent: number
  readonly variant: 'linear' | 'circle'
  readonly showLabel: boolean
  readonly size: string
  readonly id: string | undefined
  readonly label: string | undefined
}

/** Resolve the numeric value/max/percent triple from the component fields. */
function resolveProgressNumbers(c: Record<string, unknown>): {
  readonly value: number
  readonly max: number
  readonly percent: number
} {
  const value = typeof c.progressValue === 'number' ? c.progressValue : 0
  const max = typeof c.progressMax === 'number' && c.progressMax > 0 ? c.progressMax : DEFAULT_MAX
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return { value, max, percent }
}

/** Resolve the progress fields from the component definition + raw props. */
function resolveProgressFields(
  component: Component | undefined,
  rawProps: Record<string, unknown> | undefined
): ProgressFields {
  const c = (component ?? {}) as Record<string, unknown>
  const props = rawProps ?? {}
  const { value, max, percent } = resolveProgressNumbers(c)
  return {
    value,
    max,
    percent,
    variant: c.progressVariant === 'circle' ? 'circle' : 'linear',
    showLabel: c.showLabel === true,
    size: typeof c.size === 'string' ? c.size : 'md',
    id: typeof props.id === 'string' ? props.id : undefined,
    label: typeof props.label === 'string' ? props.label : undefined,
  }
}

/** Render the circular (SVG ring) progress variant. */
function renderCircle(f: ProgressFields): ReactElement {
  const diameter = CIRCLE_SIZE_PX[f.size] ?? CIRCLE_SIZE_PX.md ?? 72
  const stroke = 6
  const radius = (diameter - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - f.percent / 100)
  const center = diameter / 2
  return (
    <div
      id={f.id}
      role="progressbar"
      aria-label={f.label}
      aria-valuenow={f.value}
      aria-valuemin={0}
      aria-valuemax={f.max}
      data-component="progress"
      data-progress-variant="circle"
      className="relative inline-flex items-center justify-center"
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-call sizing in a stateless SSR renderer; rendered once on the server
      style={{ width: diameter, height: diameter }}
    >
      <svg
        width={diameter}
        height={diameter}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={computeProgressCircleTrackStroke()}
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={computeProgressCircleBarStroke()}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {f.showLabel && (
        <span className={`absolute ${computeProgressLabelClasses()}`}>{f.percent}%</span>
      )}
    </div>
  )
}

/** Render the linear (horizontal bar) progress variant. */
function renderLinear(f: ProgressFields): ReactElement {
  const height = BAR_HEIGHT_PX[f.size] ?? BAR_HEIGHT_PX.md ?? 8
  return (
    <div className="flex items-center gap-2">
      <div
        id={f.id}
        role="progressbar"
        aria-label={f.label}
        aria-valuenow={f.value}
        aria-valuemin={0}
        aria-valuemax={f.max}
        data-component="progress"
        data-progress-variant="linear"
        className={computeProgressTrackClasses()}
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-call sizing in a stateless SSR renderer; rendered once on the server
        style={{ height }}
      >
        <div
          className={computeProgressBarClasses()}
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-call fill width in a stateless SSR renderer; rendered once on the server
          style={{ width: `${f.percent}%` }}
        />
      </div>
      {f.showLabel && <span className={computeProgressLabelClasses()}>{f.percent}%</span>}
    </div>
  )
}

/**
 * Progress component renderer — dispatches to the circle or linear variant.
 */
export const progressComponent: ComponentRenderer = ({ component, rawProps }) => {
  const fields = resolveProgressFields(component, rawProps)
  return fields.variant === 'circle' ? renderCircle(fields) : renderLinear(fields)
}
