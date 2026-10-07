/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'

/** Below Tailwind's `sm` breakpoint: where a `phoneLayout: rows` grid becomes items. */
const PHONE_QUERY = '(max-width: 639.98px)'

/**
 * Whether the viewport is a phone's, followed live so a rotated or resized
 * screen swaps between the items and the grid. `false` until the first effect,
 * so the server markup and the first client render agree on the grid.
 */
export function usePhoneViewport(enabled: boolean): boolean {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    if (!enabled) return undefined
    const query = window.matchMedia(PHONE_QUERY)
    const sync = (): void => setPhone(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [enabled])
  return enabled && phone
}
