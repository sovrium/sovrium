/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, Fragment } from 'react'
import type { Responsive } from '@/domain/models/app/page/common/responsive'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Breakpoint visibility class mappings for responsive children
 *
 * Each breakpoint defines CSS classes that control when children are shown or hidden:
 * - mobile: visible <640px, hidden ≥640px
 * - sm: hidden <640px, visible 640-767px, hidden ≥768px
 * - md: hidden <768px, visible 768-1023px, hidden ≥1024px
 * - lg: hidden <1024px, visible 1024-1279px, hidden ≥1280px
 * - xl: hidden <1280px, visible 1280-1535px, hidden ≥1536px
 * - 2xl: hidden <1536px, visible ≥1536px
 */
const BREAKPOINT_VISIBILITY: Record<string, { show: string; hide: string }> = {
  mobile: { show: 'block sm:hidden', hide: 'hidden' },
  sm: { show: 'hidden sm:block md:hidden', hide: 'hidden sm:hidden' },
  md: { show: 'hidden md:block lg:hidden', hide: 'hidden md:hidden' },
  lg: { show: 'hidden lg:block xl:hidden', hide: 'hidden lg:hidden' },
  xl: { show: 'hidden xl:block 2xl:hidden', hide: 'hidden xl:hidden' },
  '2xl': { show: 'hidden 2xl:block', hide: 'hidden 2xl:hidden' },
}

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
