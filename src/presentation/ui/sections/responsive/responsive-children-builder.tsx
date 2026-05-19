/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, Fragment } from 'react'
import { BREAKPOINT_ORDER } from './responsive-resolver'
import type { Component } from '@/domain/models/app/pages/components'
import type { Responsive } from '@/domain/models/app/pages/components/responsive'

export interface ResponsiveChildrenRendererProps {
  readonly responsive: Responsive
  readonly baseChildren: readonly ReactElement[] | undefined
  readonly renderChild: (
    child: Component | string,
    index: number,
    breakpoint?: string,
    additionalClassName?: string
  ) => ReactElement
}

export function buildResponsiveChildrenVariants({
  responsive,
  baseChildren,
  renderChild,
}: ResponsiveChildrenRendererProps): readonly ReactElement[] {
  const breakpointsWithChildren = BREAKPOINT_ORDER.filter(
    (bp) => responsive[bp]?.children !== undefined
  ).map((bp) => ({ breakpoint: bp, children: responsive[bp]!.children! }))

  if (breakpointsWithChildren.length === 0) {
    return baseChildren ?? []
  }

  const childrenVariants = breakpointsWithChildren.map(({ breakpoint, children }, index) => {
    const nextBreakpoint = breakpointsWithChildren[index + 1]?.breakpoint
    const visibilityClass = nextBreakpoint
      ? breakpoint === 'mobile'
        ? `max-${nextBreakpoint}:block ${nextBreakpoint}:hidden`
        : `max-${breakpoint}:hidden ${breakpoint}:block max-${nextBreakpoint}:block ${nextBreakpoint}:hidden`
      : breakpoint === 'mobile'
        ? 'block'
        : `max-${breakpoint}:hidden ${breakpoint}:block`

    const renderedChildren = children.map((child, childIndex) =>
      renderChild(child, childIndex, breakpoint, visibilityClass)
    )

    return <Fragment key={breakpoint}>{renderedChildren}</Fragment>
  })

  return childrenVariants
}
