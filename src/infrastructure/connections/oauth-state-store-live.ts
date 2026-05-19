/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import { OAuthStateError, OAuthStateStore } from '@/application/ports/services/oauth-state-store'
import { OAUTH_STATE_TTL_MS } from '@/domain/utils/timeouts'
import type { OAuthStateEntry } from '@/application/ports/services/oauth-state-store'

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

