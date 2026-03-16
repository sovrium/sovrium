/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useSyncExternalStore } from 'react'

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
 * Subscribe to viewport breakpoint changes
 *
 * @param callback - Callback to invoke when breakpoint changes
 * @returns Unsubscribe function
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  // Call callback immediately to ensure we have the latest viewport state
  // This is important for detecting viewport changes that happened before subscription
  callback()

  // Listen to resize events
  window.addEventListener('resize', callback)

  // Create media query listeners for each breakpoint
  const mediaQueries = [
    window.matchMedia(`(min-width: ${BREAKPOINTS.sm}px)`),
    window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`),
    window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`),
    window.matchMedia(`(min-width: ${BREAKPOINTS.xl}px)`),
    window.matchMedia(`(min-width: ${BREAKPOINTS['2xl']}px)`),
  ]

  mediaQueries.forEach((mq) => {
    // Modern API
    if (mq.addEventListener) {
      mq.addEventListener('change', callback)
    } else {
      // Legacy API fallback
      mq.addListener(callback)
    }
  })

  // Listen to visualViewport resize (more reliable in some environments)
  window.visualViewport?.addEventListener('resize', callback)

  // Poll for viewport changes (for E2E tests where events might not fire)
  // This ensures responsive behavior works in automated testing environments
  // Using 16ms (one frame at 60fps) for fastest possible detection
  const pollInterval = setInterval(callback, 16)

  return () => {
    window.removeEventListener('resize', callback)
    mediaQueries.forEach((mq) => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', callback)
      } else {
        mq.removeListener(callback)
      }
    })
    window.visualViewport?.removeEventListener('resize', callback)
    clearInterval(pollInterval)
  }
}

/**
 * Get current breakpoint snapshot
 *
 * @returns Current breakpoint based on viewport width
 */
function getSnapshot(): Breakpoint {
  if (typeof window === 'undefined') return 'mobile'
  return getBreakpoint(getViewportWidth())
}

/**
 * Get server-side breakpoint (always mobile for SSR)
 *
 * @returns Mobile breakpoint
 */
function getServerSnapshot(): Breakpoint {
  return 'mobile'
}

/**
 * Hook to detect current viewport breakpoint
 *
 * Returns the current breakpoint based on window width.
 * Updates automatically when viewport is resized.
 * Uses useSyncExternalStore for reliable external state synchronization.
 *
 * Uses matchMedia to detect breakpoint changes reliably, which works with
 * both user-initiated resizes and programmatic viewport changes (e.g., Playwright's setViewportSize).
 *
 * @returns Current breakpoint name
 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
