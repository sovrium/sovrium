/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two ends of the OAuth2 `state` round trip.
 *
 * `state` is what ties a redirect back to the request that started it. It is
 * written once at authorize time and consumed exactly once at callback time —
 * consumption is a DELETE, which is what makes a leaked state single-use — and
 * the entry carries the PKCE verifier and the redirect URI the authorize step
 * actually sent, so the token exchange cannot silently use different ones.
 *
 * It also carries the originating `userId`. The callback compares it against
 * the session presenting the code, which is the defence against a leaked state
 * being redeemed by a different signed-in user; the comparison itself lives with
 * the handler, because "which session is this" is not a question this layer can
 * see.
 */

import { Effect } from 'effect'
import { OAuthStateStore } from '@/application/ports/services/oauth-state-store'
import type {
  OAuthStateEntry,
  OAuthStateError,
} from '@/application/ports/services/oauth-state-store'

/** Record the state of an authorize request, to be redeemed by its callback. */
export const saveOAuthState = (input: {
  readonly state: string
  readonly connectionName: string
  readonly userId: string
  readonly codeVerifier: string | undefined
  readonly redirectUri: string
}): Effect.Effect<void, OAuthStateError, OAuthStateStore> =>
  Effect.gen(function* () {
    const store = yield* OAuthStateStore
    yield* store.save(input.state, {
      connectionName: input.connectionName,
      userId: input.userId,
      codeVerifier: input.codeVerifier,
      redirectUri: input.redirectUri,
    })
  }).pipe(Effect.withSpan('connections.save-oauth-state'))

/** Redeem a state value. `undefined` means unknown, already used, or expired. */
export const consumeOAuthState = (
  state: string
): Effect.Effect<OAuthStateEntry | undefined, OAuthStateError, OAuthStateStore> =>
  Effect.gen(function* () {
    const store = yield* OAuthStateStore
    return yield* store.consume(state)
  }).pipe(Effect.withSpan('connections.consume-oauth-state'))
