/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, useEffect } from 'react'

/**
 * Breakpoint type matching responsive schema
 */
export type Breakpoint = 'mobile' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/**
 * Tailwind default breakpoints (min-width)
 */
const BREAKPOINTS: Record<Exclude<Breakpoint, 'mobile'>, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

/**
 * Gets current viewport width from multiple sources
 *
 * Playwright's setViewportSize() updates document.documentElement.clientWidth
 * but may not update window.innerWidth immediately. Try multiple sources.
 *
 * @returns Current viewport width in pixels
 */
function getViewportWidth(): number {
  // Try multiple sources for maximum compatibility
  return (
    document.documentElement.clientWidth ||
    document.body.clientWidth ||
    window.innerWidth ||
    0
  )
}

/**
 * Determines current breakpoint from window width
 *
 * @param width - Window width in pixels
 * @returns Current breakpoint name
 */
function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS['2xl']) return '2xl'
  if (width >= BREAKPOINTS.xl) return 'xl'
  if (width >= BREAKPOINTS.lg) return 'lg'
  if (width >= BREAKPOINTS.md) return 'md'
  if (width >= BREAKPOINTS.sm) return 'sm'
  return 'mobile'
}

/**
 * Hook to detect current viewport breakpoint
 *
 * Returns the current breakpoint based on window width.
 * Updates automatically when viewport is resized.
 *
 * Uses multiple detection methods for maximum compatibility:
 * 1. ResizeObserver on document.body (works with Playwright setViewportSize)
 * 2. Window resize events (production fallback)
 * 3. Polling (final fallback for edge cases)
 *
 * @returns Current breakpoint name
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window !== 'undefined' ? getBreakpoint(getViewportWidth()) : 'mobile'
  )

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = getViewportWidth()
      const newBreakpoint = getBreakpoint(width)
      setBreakpoint((prev) => (prev !== newBreakpoint ? newBreakpoint : prev))
    }

    // Initial update
    updateBreakpoint()

    // Method 1: ResizeObserver on document.documentElement (detects Playwright viewport changes)
    const resizeObserver = new ResizeObserver(() => {
      updateBreakpoint()
    })
    resizeObserver.observe(document.documentElement)

    // Method 2: Window resize events (production fallback)
    window.addEventListener('resize', updateBreakpoint)

    // Method 3: Aggressive polling (10ms for Playwright compatibility)
    const pollInterval = setInterval(updateBreakpoint, 10)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateBreakpoint)
      clearInterval(pollInterval)
    }
  }, [])

  return breakpoint
}
