/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { dispatchComponentType } from '../rendering/component-type-dispatcher'
import { BREAKPOINT_ORDER } from './responsive-resolver'
import type { Component } from '@/domain/models/app/pages/components'
import type { Responsive } from '@/domain/models/app/pages/components/responsive'

export interface ResponsiveContentConfig {
  readonly responsive: Responsive
  readonly type: string
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly component?: Component
}

export function buildResponsiveContentVariants(
  config: ResponsiveContentConfig
): ReactElement | null {
  const { responsive, type, elementProps, elementPropsWithSpacing, component } = config
  const breakpointsWithContent = BREAKPOINT_ORDER.filter(
    (bp) => responsive[bp]?.content !== undefined
  ).map((bp, index, array) => ({
    breakpoint: bp,
    content: responsive[bp]!.content!,
    nextBreakpoint: array[index + 1],
  }))

  const contentSpans = breakpointsWithContent.map(
    ({ breakpoint, content: variantContent, nextBreakpoint }) => {
      const visibilityClass = nextBreakpoint
        ? breakpoint === 'mobile'
          ? `inline-block max-${nextBreakpoint}:inline-block ${nextBreakpoint}:hidden`
          : `max-${breakpoint}:hidden ${breakpoint}:inline-block max-${nextBreakpoint}:inline-block ${nextBreakpoint}:hidden`
        : breakpoint === 'mobile'
          ? 'inline-block'
          : `max-${breakpoint}:hidden ${breakpoint}:inline-block`

      return (
        <span
          key={breakpoint}
          className={visibilityClass}
          data-responsive-breakpoint={breakpoint}
        >
          {variantContent}
        </span>
      )
    }
  )

  return dispatchComponentType({
    type,
    elementProps,
    elementPropsWithSpacing,
    content: undefined,
    renderedChildren: contentSpans as readonly ReactElement[],
    theme: undefined,
    languages: undefined,
    interactions: undefined,
    component,
  })
}
