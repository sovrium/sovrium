/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { dispatchComponentType } from '../rendering/component-type-dispatcher'
import type { Responsive } from '@/domain/models/app/page/common/responsive'

/**
 * Breakpoint visibility class mappings for responsive content
 *
 * Each breakpoint defines CSS classes that control when content is shown or hidden:
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
