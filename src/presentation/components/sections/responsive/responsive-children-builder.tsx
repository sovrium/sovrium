/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, Fragment } from 'react'
import { BREAKPOINT_VISIBILITY } from './responsive-visibility-classes'
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
    breakpoint?: string
  ) => ReactElement
}

/**
 * Builds responsive children variants using CSS-based approach
 *
 * Renders wrapper divs for each breakpoint's children array.
 * Each wrapper is shown/hidden via Tailwind visibility classes based on viewport width.
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
  // Collect all breakpoints with children overrides
  const breakpointsWithChildren = Object.entries(responsive)
    .filter(([, overrides]) => overrides.children !== undefined)
    .map(([bp, overrides]) => ({ breakpoint: bp, children: overrides.children! }))

  // If no responsive children overrides, return base children
  if (breakpointsWithChildren.length === 0) {
    return baseChildren ?? []
  }

  // Build wrapper divs for each breakpoint's children
  const childrenVariants = breakpointsWithChildren.map(({ breakpoint, children }) => {
    const visibilityClass = BREAKPOINT_VISIBILITY[breakpoint]?.show || 'block'

    // Render children for this breakpoint
    const renderedChildren = children.map((child, index) => renderChild(child, index, breakpoint))

    return (
      <Fragment key={breakpoint}>
        {renderedChildren.map((child, index) => (
          <div
            key={`${breakpoint}-${index}`}
            className={visibilityClass}
            data-responsive-breakpoint={breakpoint}
          >
            {child}
          </div>
        ))}
      </Fragment>
    )
  })

  return childrenVariants
}
