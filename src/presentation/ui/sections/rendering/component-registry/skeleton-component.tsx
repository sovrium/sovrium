/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

const VARIANT_RADIUS: Readonly<Record<string, string>> = {
  text: 'rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-md',
}

interface SkeletonFields {
  readonly variant: string
  readonly width: string
  readonly height: string
  readonly animate: boolean
  readonly id: string | undefined
}

function resolveSkeletonFields(
  component: Component | undefined,
  rawProps: Record<string, unknown> | undefined
): SkeletonFields {
  const c = (component ?? {}) as Record<string, unknown>
  const props = rawProps ?? {}
  return {
    variant: typeof c.skeletonVariant === 'string' ? c.skeletonVariant : 'text',
    width: typeof c.skeletonWidth === 'string' ? c.skeletonWidth : '100%',
    height: typeof c.skeletonHeight === 'string' ? c.skeletonHeight : '1rem',
    animate: c.animate !== false,
    id: typeof props.id === 'string' ? props.id : undefined,
  }
}

export const skeletonComponent: ComponentRenderer = ({ component, rawProps }) => {
  const f = resolveSkeletonFields(component, rawProps)
  const radius = VARIANT_RADIUS[f.variant] ?? VARIANT_RADIUS.text
  const animateClass = f.animate ? 'animate-pulse' : ''
  const className = `skeleton bg-muted ${radius} ${animateClass}`.trim()
  const skeleton: ReactElement = (
    <div
      id={f.id}
      data-skeleton=""
      data-component="skeleton"
      data-skeleton-variant={f.variant}
      data-animate={f.animate ? 'true' : 'false'}
      aria-hidden="true"
      className={className}
      style={{ width: f.width, height: f.height }}
    />
  )
  return skeleton
}
