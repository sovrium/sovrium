/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'

/**
 * Custom hook for detecting scroll position
 *
 * @param enabled - Whether scroll detection is enabled
 * @param threshold - Scroll threshold in pixels (default: 100)
 * @returns Whether the page has been scrolled past the threshold
 */
export function useScrollDetection(enabled: boolean, threshold = 100): boolean {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    if (!enabled) {
      console.log('[useScrollDetection] Disabled, skipping')
      return
    }

    const checkScroll = () => {
      const scrollY = window.scrollY
      const shouldBeScrolled = scrollY > threshold
      console.log(`[useScrollDetection] scrollY=${scrollY}, threshold=${threshold}, shouldBeScrolled=${shouldBeScrolled}`)
      setIsScrolled(shouldBeScrolled)
    }

    // Check initial scroll position immediately
    console.log('[useScrollDetection] Initial check')
    checkScroll()

    // Set up scroll event listener
    window.addEventListener('scroll', checkScroll)

    // Also check periodically in case scroll events don't fire (e.g., in tests)
    const intervalId = setInterval(checkScroll, 50)

    return () => {
      console.log('[useScrollDetection] Cleanup')
      window.removeEventListener('scroll', checkScroll)
      clearInterval(intervalId)
    }
  }, [enabled, threshold])

  return isScrolled
}
