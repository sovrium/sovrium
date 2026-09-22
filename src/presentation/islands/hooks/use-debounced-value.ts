/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Settle a fast-changing value before anything expensive reads it.
 *
 * ─── WHY A VALUE AND NOT A CALLBACK ─────────────────────────────────────────
 *
 * The islands used to debounce the REQUEST: a timer inside the fetching effect,
 * plus a way to drop the answer of a request a later keystroke had superseded —
 * an `AbortController` in one picker, a monotonic request-id ref in the command
 * palette. Both are re-implementations of what a query cache does for free, and
 * both were needed only because the debounce sat on the wrong side of the fetch.
 *
 * Debouncing the VALUE instead puts it on the query KEY. A superseded keystroke
 * then cannot land late, because it never had a key of its own: TanStack keys
 * the in-flight request, so the answer to a key nobody is observing is simply
 * not rendered. Stale-response dropping stops being a thing to implement.
 *
 * `useDeferredValue` was considered and refused: it yields on RENDER pressure,
 * which says nothing about how long the operator has stopped typing, and the
 * three call sites have three deliberately different, spec-visible delays.
 */

import { useEffect, useState } from 'react'

/**
 * @param value - the live value, updated on every keystroke.
 * @param delayMs - how long the value must hold still before it is published.
 * @param immediateWhen - publish synchronously while this holds, bypassing the
 *   delay. The candidate pickers open on a double-click and ask for their first
 *   page with an EMPTY term: waiting out a typing debounce before showing any
 *   candidate would make the control look empty at the moment it appears.
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs: number,
  immediateWhen?: (value: T) => boolean
): T {
  const immediate = immediateWhen?.(value) ?? false
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    if (immediate) {
      setDebounced(value)
      return undefined
    }
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs, immediate])

  return immediate ? value : debounced
}
