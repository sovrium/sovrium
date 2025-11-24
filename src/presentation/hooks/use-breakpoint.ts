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
 * Gets current viewport width (works in both normal browsers and test environments)
 *
 * Prioritizes document.documentElement.clientWidth for Playwright compatibility
 *
 * @returns Viewport width in pixels
 */
function getViewportWidth(): number {
  // Use document.documentElement.clientWidth first (most reliable in Playwright)
  if (typeof document !== 'undefined' && document.documentElement) {
    return document.documentElement.clientWidth
  }
  // Try visualViewport (reliable in some browsers/test environments)
  if (typeof window !== 'undefined' && window.visualViewport?.width) {
    return window.visualViewport.width
  }
  // Fallback to innerWidth
  if (typeof window !== 'undefined' && window.innerWidth) {
    return window.innerWidth
  }
  // Last resort fallback
  return 0
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
 * Uses multiple detection methods for maximum compatibility (including E2E tests).
 *
 * @returns Current breakpoint name
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window !== 'undefined' ? getBreakpoint(getViewportWidth()) : 'mobile'
  )

  useEffect(() => {
    const updateBreakpoint = () => {
      const newBreakpoint = getBreakpoint(getViewportWidth())
      setBreakpoint((current) => (current !== newBreakpoint ? newBreakpoint : current))
    }

    // Initial update on mount
    updateBreakpoint()

    // Listen to resize events
    window.addEventListener('resize', updateBreakpoint)

    // Also use matchMedia for reliable breakpoint detection
    const mediaQueries = [
      window.matchMedia(`(min-width: ${BREAKPOINTS.sm}px)`),
      window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`),
      window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`),
      window.matchMedia(`(min-width: ${BREAKPOINTS.xl}px)`),
      window.matchMedia(`(min-width: ${BREAKPOINTS['2xl']}px)`),
    ]

    mediaQueries.forEach((mq) => {
      mq.addEventListener('change', updateBreakpoint)
    })

    // Listen to visualViewport resize (more reliable in some environments)
    // Use optional chaining for null safety
    window.visualViewport?.addEventListener('resize', updateBreakpoint)

    // Poll for viewport changes (for E2E tests where events might not fire)
    // This ensures responsive behavior works in automated testing environments
    // Using 50ms for faster detection in test environments
    const pollInterval = setInterval(updateBreakpoint, 50)

    return () => {
      window.removeEventListener('resize', updateBreakpoint)
      mediaQueries.forEach((mq) => {
        mq.removeEventListener('change', updateBreakpoint)
      })
      // Use optional chaining for null safety
      window.visualViewport?.removeEventListener('resize', updateBreakpoint)
      clearInterval(pollInterval)
    }
  }, [])

  return breakpoint
}
