/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState } from 'react'

/**
 * Tailwind's `sm` breakpoint, applied to the bar's own width rather than the
 * viewport's: below it the bar folds as it does on a phone.
 */
const NARROW_BAR_PX = 640

/**
 * Whether the bar is narrower than a phone screen, followed live — a grid in a
 * side card is as narrow as a phone on a desktop screen, and its bottom bar must
 * fold the same way to stay on one line. `false` until measured, so the server
 * markup and the first client render agree.
 *
 * Returns a ref callback for the bar and the answer.
 */
export function useNarrowBar(): readonly [(element: HTMLElement | null) => void, boolean] {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (element === null) return undefined
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setNarrow(entry.contentRect.width < NARROW_BAR_PX)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  const ref = useCallback((node: HTMLElement | null) => setElement(node), [])
  return [ref, narrow] as const
}
