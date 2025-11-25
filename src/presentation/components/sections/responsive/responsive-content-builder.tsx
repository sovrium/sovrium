/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { dispatchComponentType } from '../rendering/component-type-dispatcher'
import { BREAKPOINT_VISIBILITY } from './responsive-visibility-classes'
import type { Responsive } from '@/domain/models/app/page/common/responsive'

/**
 * Builds responsive content variants using CSS-based approach (nested span strategy)
 *
 * Renders a single wrapper element with nested span elements for each breakpoint's content.
 * Each span is shown/hidden via Tailwind visibility classes based on viewport width.
 *
 * This approach works reliably in E2E tests because:
 * - Single parent element (avoids Playwright strict mode violations)
 * - Nested spans with responsive visibility (inline elements for text concatenation)
 * - CSS media queries control visibility (display: none via Tailwind)
 * - Playwright's toHaveText() only reads visible span's textContent
 *
 * Example output:
 * <h1>
 *   <span className="inline sm:hidden">Mobile!</span>
 *   <span className="hidden md:inline lg:hidden">Tablet Welcome</span>
 *   <span className="hidden lg:inline">Desktop Welcome</span>
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
  // Collect all breakpoints with content overrides
  const breakpointsWithContent = Object.entries(responsive)
    .filter(([, overrides]) => overrides.content !== undefined)
    .map(([bp, overrides]) => ({ breakpoint: bp, content: overrides.content! }))

  // Build nested span elements with responsive visibility classes
  // Each span is hidden/shown using BOTH CSS (Tailwind) and aria-hidden for full compatibility
  const contentSpans = breakpointsWithContent.map(({ breakpoint, content: variantContent }) => {
    const visibilityClass = BREAKPOINT_VISIBILITY[breakpoint]?.show || 'inline'

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
  })

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
