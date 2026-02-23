/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { dispatchComponentType } from '../rendering/component-type-dispatcher'
import { BREAKPOINT_ORDER } from './responsive-resolver'
import type { Responsive } from '@/domain/models/app/page/common/responsive'

/**
 * Builds responsive content variants using CSS-based approach (nested span strategy)
 *
 * Renders a single wrapper element with nested span elements for each breakpoint's content.
 * Each span is shown/hidden via Tailwind visibility classes based on viewport width.
 *
 * Uses mobile-first approach with upper-bound hiding:
 * - If next breakpoint has override: hide from next breakpoint (e.g., "inline max-md:inline md:hidden")
 * - If no next override: show from this breakpoint onwards (e.g., "max-md:hidden md:inline")
 *
 * This approach works reliably in E2E tests because:
 * - Single parent element (avoids Playwright strict mode violations)
 * - Nested spans with responsive visibility (inline elements for text concatenation)
 * - CSS media queries control visibility (display: none via Tailwind)
 * - Playwright's toHaveText() only reads visible span's textContent
 *
 * Example output:
 * <h1>
 *   <span className="inline max-md:inline md:hidden">Mobile!</span>
 *   <span className="max-md:hidden md:inline max-lg:inline lg:hidden">Tablet Welcome</span>
 *   <span className="max-lg:hidden lg:inline">Desktop Welcome</span>
 * </h1>
 *
 * @param responsive - Responsive configuration
 * @param type - Component type (e.g., 'heading', 'text')
 * @param elementProps - Element props for the wrapper
 * @param elementPropsWithSpacing - Element props with spacing
 * @returns ReactElement with nested responsive content spans (or null if dispatcher returns null)
 */
export function buildResponsiveContentVariants(
  responsive: Responsive,
  type: string,
  elementProps: Record<string, unknown>,
  elementPropsWithSpacing: Record<string, unknown>
): ReactElement | null {
  // Collect all breakpoints with content overrides, maintaining order
  const breakpointsWithContent = BREAKPOINT_ORDER.filter(
    (bp) => responsive[bp]?.content !== undefined
  ).map((bp, index, array) => ({
    breakpoint: bp,
    content: responsive[bp]!.content!,
    nextBreakpoint: array[index + 1],
  }))

  // Build nested span elements with responsive visibility classes
  const contentSpans = breakpointsWithContent.map(
    ({ breakpoint, content: variantContent, nextBreakpoint }) => {
      // Calculate visibility class using block/hidden for proper Tailwind display toggling
      // Same logic as children builder but using inline-block for text content
      const visibilityClass = nextBreakpoint
        ? breakpoint === 'mobile'
          ? `inline-block max-${nextBreakpoint}:inline-block ${nextBreakpoint}:hidden` // Mobile: show below next BP, hide at/above
          : `max-${breakpoint}:hidden ${breakpoint}:inline-block max-${nextBreakpoint}:inline-block ${nextBreakpoint}:hidden` // Mid: hide below, show in range, hide above
        : breakpoint === 'mobile'
          ? 'inline-block' // Mobile with no next: always visible
          : `max-${breakpoint}:hidden ${breakpoint}:inline-block` // Last breakpoint: hide below, show at/above

      // Use data attribute to track which breakpoint this span represents
      // This helps with debugging and ensures each span is uniquely identifiable
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

  // Dispatch the wrapper component with nested content spans as children
  return dispatchComponentType({
    type,
    elementProps,
    elementPropsWithSpacing,
    content: undefined,
    renderedChildren: contentSpans as readonly ReactElement[],
    theme: undefined,
    languages: undefined,
    interactions: undefined,
  })
}
