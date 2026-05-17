/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-loop-statements, functional/no-expression-statements, functional/immutable-data, drizzle/enforce-delete-with-where -- module-level Map is the deliberate design for the OAuth state store; .delete() calls below are Map.prototype.delete, not Drizzle deletes */

import { Effect, Layer } from 'effect'
import { OAuthStateError, OAuthStateStore } from '@/application/ports/services/oauth-state-store'
import { OAUTH_STATE_TTL_MS } from '@/domain/utils/timeouts'
import type { OAuthStateEntry } from '@/application/ports/services/oauth-state-store'

/**
 * In-memory OAuth `state` store with TTL.
 *
 * The OAuth2 authorization-code flow generates a random `state` value
 * during /authorize, sends it to the provider, and expects to see the
 * same value echoed back at /callback. This Live impl stores the state
 * alongside its companion data (PKCE verifier, original connection name,
 * requesting user id, redirect target, expiry) in a module-level Map.
 *
 * In-memory is intentional: the state must survive only the single
 * authorize→callback hop within one server process. Persisting to the
 * database would widen this PR's scope (another schema, another
 * repository) without buying anything — the data is short-lived and
 * single-use.
 *
 * TTL: `OAUTH_STATE_TTL_MS` (10 minutes). After that the state is purged
 * on the next access (lazy expiration; no background sweep). Specs
 * assert /callback rejects unknown or expired states with 400.
 *
 * Module-level Map is acceptable per Sovrium's Bun-test conventions
 * because OAuth state is per-process by design — there is no
 * cross-test contamination risk for E2E specs running against a
 * dedicated server process. The Live layer captures the Map by
 * reference inside its closure; layer rebuild would not reset state,
 * which matches production semantics (no rebuild ever happens).
 */
const store = new Map<string, OAuthStateEntry>()

const purgeExpired = (now: number): void => {
  for (const [state, entry] of store) {
    if (entry.expiresAt < now) {
      store.delete(state)
    }
  }
}

export const OAuthStateStoreLive = Layer.succeed(
  OAuthStateStore,
  OAuthStateStore.of({
    save: (state, entry) =>
      Effect.try({
        try: () => {
          const now = Date.now()
          purgeExpired(now)
          store.set(state, { ...entry, expiresAt: now + OAUTH_STATE_TTL_MS })
        },
        catch: (cause: unknown) => new OAuthStateError({ cause }),
      }),

    consume: (state) =>
      Effect.try({
        try: () => {
          const now = Date.now()
          purgeExpired(now)
          const entry = store.get(state)
          if (entry === undefined) return undefined
          store.delete(state)
          return entry
        },
        catch: (cause: unknown) => new OAuthStateError({ cause }),
      }),

    clear: () =>
      Effect.try({
        try: () => {
          store.clear()
        },
        catch: (cause: unknown) => new OAuthStateError({ cause }),
      }),
  })
)

/* eslint-enable functional/no-loop-statements, functional/no-expression-statements, functional/immutable-data, drizzle/enforce-delete-with-where */
