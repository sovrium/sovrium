/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SSR renderer for the `skeleton` page component.
 *
 * Renders a loading-placeholder block sized by the author-declared
 * `skeletonWidth` / `skeletonHeight` CSS lengths. The `skeletonVariant`
 * controls the shape:
 *  - `text` (default): slightly-rounded bar.
 *  - `circular`: a full circle (avatar placeholder).
 *  - `rectangular`: a square-cornered block (card/image placeholder).
 *
 * `animate` (default `true`) applies Tailwind's `animate-pulse` so the
 * placeholder visibly shimmers; setting it `false` renders a static block.
 * The author-declared `props.id` is placed on the element so layout
 * assertions can resolve and measure it via `#id`.
 *
 * Pure SSR component — no interactivity, no island required.
 *
 * Visual tone ([internal ref], prestyled-by-default) comes from
 * {@link computeSkeletonClasses} — a Tailwind recipe with inline OKLCH
 * var-fallbacks so a schema author who writes the bare `{ type: 'skeleton' }`
 * gets a complete, opinionated placeholder (bg-subtle fill, variant-aware
 * radius, animate-pulse shimmer) with zero theme-layer dependency.
 */

import {
  computeSkeletonClasses,
  type SkeletonVariant,
} from '../../renderers/element-renderers/recipes/feedback-default-classes'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

const SKELETON_VARIANTS = new Set<SkeletonVariant>(['text', 'circular', 'rectangular'])

function resolveSkeletonVariant(value: unknown): SkeletonVariant {
  return typeof value === 'string' && SKELETON_VARIANTS.has(value as SkeletonVariant)
    ? (value as SkeletonVariant)
    : 'text'
}

interface SkeletonFields {
  readonly variant: SkeletonVariant
  readonly width: string
  readonly height: string
  readonly animate: boolean
  readonly id: string | undefined
}

/** Resolve the skeleton fields from the component definition + raw props. */
function resolveSkeletonFields(
  component: Component | undefined,
  rawProps: Record<string, unknown> | undefined
): SkeletonFields {
  const c = (component ?? {}) as Record<string, unknown>
  const props = rawProps ?? {}
  return {
    variant: resolveSkeletonVariant(c.skeletonVariant),
    width: typeof c.skeletonWidth === 'string' ? c.skeletonWidth : '100%',
    height: typeof c.skeletonHeight === 'string' ? c.skeletonHeight : '1rem',
    animate: c.animate !== false,
    id: typeof props.id === 'string' ? props.id : undefined,
  }
}

/**
 * Skeleton component renderer.
 */
export const skeletonComponent: ComponentRenderer = ({ component, rawProps }) => {
  const f = resolveSkeletonFields(component, rawProps)
  const className = computeSkeletonClasses({ variant: f.variant, animate: f.animate })
  const skeleton: ReactElement = (
    <div
      id={f.id}
      data-skeleton=""
      data-component="skeleton"
      data-skeleton-variant={f.variant}
      data-animate={f.animate ? 'true' : 'false'}
      aria-hidden="true"
      className={className}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-call sizing in a stateless SSR renderer; rendered once on the server
      style={{ width: f.width, height: f.height }}
    />
  )
  return skeleton
}
