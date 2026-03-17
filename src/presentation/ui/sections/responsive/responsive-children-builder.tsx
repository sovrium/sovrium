/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, Fragment } from 'react'
import { BREAKPOINT_ORDER } from './responsive-resolver'
import type { Responsive } from '@/domain/models/app/page/common/responsive'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Props for responsive children renderer
 */
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

/**
 * Builds responsive children variants using CSS-based approach
 *
 * Renders wrapper divs for each breakpoint's children array.
 * Each wrapper is shown/hidden via Tailwind visibility classes based on viewport width.
 *
 * Uses mobile-first approach with upper-bound hiding:
 * - If next breakpoint has override: hide from next breakpoint (e.g., "block lg:hidden")
 * - If no next override: show from this breakpoint onwards (e.g., "hidden lg:block")
 *
 * This approach works reliably in E2E tests because:
 * - All children variants rendered server-side
 * - CSS media queries control visibility (no JavaScript required)
 * - Playwright can query visible children after viewport changes
 * - No React state updates needed for viewport changes
 *
 * Example output:
 * <nav>
 *   <div className="block lg:hidden">
 *     <button>☰</button>
 *   </div>
 *   <div className="hidden lg:block">
 *     <a>Home</a>
 *     <a>About</a>
 *     <a>Contact</a>
 *   </div>
 * </nav>
 *
 * @param props - Responsive children renderer props
 * @returns ReactElement with responsive children variants wrapped in visibility containers
 */
export function buildResponsiveChildrenVariants({
  responsive,
  baseChildren,
  renderChild,
}: ResponsiveChildrenRendererProps): readonly ReactElement[] {
  // Collect all breakpoints with children overrides, maintaining order
  const breakpointsWithChildren = BREAKPOINT_ORDER.filter(
    (bp) => responsive[bp]?.children !== undefined
  ).map((bp) => ({ breakpoint: bp, children: responsive[bp]!.children! }))

  // If no responsive children overrides, return base children
  if (breakpointsWithChildren.length === 0) {
    return baseChildren ?? []
  }

  // Build responsive children variants by cloning elements with visibility classes
  const childrenVariants = breakpointsWithChildren.map(({ breakpoint, children }, index) => {
    // Determine visibility class based on next breakpoint override
    // Use max-* utilities for upper bounds (mobile-first approach)
    const nextBreakpoint = breakpointsWithChildren[index + 1]?.breakpoint
    const visibilityClass = nextBreakpoint
      ? breakpoint === 'mobile'
        ? `max-${nextBreakpoint}:block ${nextBreakpoint}:hidden` // Mobile: show below next BP, hide at/above
        : `max-${breakpoint}:hidden ${breakpoint}:block max-${nextBreakpoint}:block ${nextBreakpoint}:hidden` // Mid: hide below, show in range, hide above
      : breakpoint === 'mobile'
        ? 'block' // Mobile with no next: always visible
        : `max-${breakpoint}:hidden ${breakpoint}:block` // Last breakpoint: hide below, show at/above

    // Render children for this breakpoint with visibility class passed to renderChild
    // The renderChild callback will inject the className into the component's props
    const renderedChildren = children.map((child, childIndex) =>
      renderChild(child, childIndex, breakpoint, visibilityClass)
    )

    return <Fragment key={breakpoint}>{renderedChildren}</Fragment>
  })

  return childrenVariants
}
