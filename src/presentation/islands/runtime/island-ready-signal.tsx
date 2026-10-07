/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect } from 'react'

/**
 * The ready marker an island host carries once its island has actually
 * rendered.
 */

/**
 * Signals to the test harness (and any other observer) that the island has
 * actually mounted — i.e. the lazy chunk has resolved, the real Component has
 * rendered, and the Suspense boundary has settled. Rendered as a sibling of
 * `<Component>` INSIDE `<Suspense>` so its `useEffect` only commits after the
 * lazy import completes; while Suspense is still showing the SSR-skeleton
 * fallback, the effect does not run and `data-island-ready` is NOT set.
 *
 * Why this matters: the previous synchronous `host.setAttribute(...)` call
 * immediately after `flushSync` fired before lazy chunks resolved, so any
 * `[data-island-ready]` gate (E2E specs reading computed styles, etc.)
 * unblocked against the still-mounted SSR skeleton — race window where
 * `getComputedStyle()` returned empty/transparent paint.
 */
export function IslandReadySignal({ host }: { readonly host: HTMLElement }): null {
  useEffect(() => {
    host.setAttribute('data-island-ready', 'true')
  }, [host])
  return null
}
