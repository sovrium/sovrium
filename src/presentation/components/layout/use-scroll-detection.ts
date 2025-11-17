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
    if (!enabled) return

    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [enabled, threshold])

  return isScrolled
}
