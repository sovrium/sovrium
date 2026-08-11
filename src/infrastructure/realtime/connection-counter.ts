/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements, functional/immutable-data -- in-process counter intentionally mutates a Map in place */

/**
 * Per-user concurrent realtime-transport connection counter
 *.
 *
 * The realtime subscribe endpoint enforces a configurable cap
 * (`REALTIME_TRANSPORT_CONFIG.maxConnectionsPerUser`, default 10) on the
 * number of live SSE / WebSocket connections a single authenticated user
 * may hold concurrently. A new connection beyond the cap is rejected with
 * HTTP 429 + `Retry-After`.
 *
 * The cap is keyed by user id and scoped per process. For horizontal
 * scaling, replace the in-memory `Map` with a shared store (Redis
 * `INCRBY`/`DECR`); the public functions stay the same so callers do not
 * change.
 */

import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'

/** Per-user counter of currently-held realtime connections. */
const userConnectionCounts = new Map<string, number>()

/**
 * Result of attempting to register one more connection for a user.
 *
 * `accepted` carries a `release` thunk the caller MUST invoke when the
 * connection terminates (SSE stream `cancel`, WebSocket `onClose`, or the
 * bounded `SSE_STREAM_MAX_LIFETIME_MS` timeout) so the counter does not
 * leak across the process lifetime.
 */
export type ConnectionRegistration =
  | { readonly accepted: true; readonly release: () => void }
  | { readonly accepted: false; readonly current: number; readonly limit: number }

/**
 * Attempt to register a new connection for `userId`. Returns an accepting
 * registration carrying a single-shot `release` thunk, or a rejection
 * with the observed `current` count and the configured `limit` so the
 * route handler can produce a precise 429 response body.
 *
 * `release` is idempotent — calling it twice from the same connection's
 * teardown paths (e.g. both `cancel` and the lifetime timeout) does not
 * double-decrement the counter.
 */
export const registerConnection = (userId: string): ConnectionRegistration => {
  const limit = REALTIME_TRANSPORT_CONFIG.maxConnectionsPerUser
  const current = userConnectionCounts.get(userId) ?? 0
  if (current >= limit) {
    return { accepted: false, current, limit }
  }
  userConnectionCounts.set(userId, current + 1)
  // eslint-disable-next-line functional/no-let -- single-shot release guard
  let released = false
  return {
    accepted: true,
    release: () => {
      if (released) return
      released = true
      const remaining = (userConnectionCounts.get(userId) ?? 0) - 1
      if (remaining <= 0) {
        // eslint-disable-next-line drizzle/enforce-delete-with-where
        userConnectionCounts.delete(userId)
      } else {
        userConnectionCounts.set(userId, remaining)
      }
    },
  }
}

/** Diagnostics / tests — current connection count for `userId` (0 if none). */
export const getConnectionCount = (userId: string): number => userConnectionCounts.get(userId) ?? 0

/** Diagnostics / tests — reset all counters (use only in test teardown). */
export const resetConnectionCountersForTesting = (): void => {
  userConnectionCounts.clear()
}
