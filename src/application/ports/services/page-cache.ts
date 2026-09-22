/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect } from 'effect'

/** A cached page render plus the time it was stored (for diagnostics). */
export interface CachedPage {
  readonly html: string
  readonly timestamp: number
}

/**
 * Read/write port over the process-local store of rendered page HTML.
 *
 * ### Why this is a port when the key builder is not
 *
 * They were one module until W5c, and only one of them is behaviour.
 * {@link ../../../domain/models/app/pages/page-cache-key.getPageCacheKey} is a
 * pure concatenation of values the caller already holds, so it went to the
 * domain and every layer may call it directly. These two touch a process-global
 * `Ref`, read `ECO_PAGE_CACHE_MAX_MB` per insert, and publish occupancy
 * telemetry on every admission. An area-level allowance cannot tell the two
 * apart, so opening `infrastructure-server` to the HTTP surface to get the key
 * builder would have opened the whole server tree — the listener, the Bun
 * socket, the Hono assembly — to every route handler.
 *
 * ### Two methods, because two things cross
 *
 * Eviction, the byte budget, the admission rule and the occupancy counters stay
 * inside the implementation. A route asks whether this key has HTML and offers
 * HTML for a key; whether the offer is accepted, and what it displaces, is the
 * store's business and is not observable here. `clearPageCache` is deliberately
 * NOT on the port: its callers are the test harness and the hot-reload path,
 * neither of which is a request, and publishing it would invite a route to
 * empty a cache it does not own.
 *
 * Neither method can fail. A cache is an optimisation: a miss is an ordinary
 * answer, and a store that refuses an oversized entry has not failed either —
 * the page still renders and still ships. Nothing a caller could do with an
 * error channel here differs from what it already does on a miss.
 */
export class PageCache extends Context.Service<
  PageCache,
  {
    /** The HTML stored under `cacheKey`, or `undefined` when there is none. */
    readonly get: (cacheKey: string) => Effect.Effect<CachedPage | undefined>

    /**
     * Offer a render for `cacheKey`.
     *
     * Admission is the store's decision: an entry larger than the whole budget
     * is refused outright, and admitting one may evict insertion-order-oldest
     * entries until the total fits. The caller is told neither, because neither
     * changes the response it is about to send.
     */
    readonly set: (cacheKey: string, page: CachedPage) => Effect.Effect<void>
  }
>()('PageCache') {}
