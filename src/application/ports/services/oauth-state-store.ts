/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class OAuthStateError extends Data.TaggedError('OAuthStateError')<{
  readonly cause: unknown
}> {}

export interface OAuthStateEntry {
  readonly connectionName: string
  readonly userId: string
  readonly codeVerifier: string | undefined
  readonly redirectUri: string
  readonly expiresAt: number
}

export class OAuthStateStore extends Context.Tag('OAuthStateStore')<
  OAuthStateStore,
  {
    readonly save: (
      state: string,
      entry: Omit<OAuthStateEntry, 'expiresAt'>
    ) => Effect.Effect<void, OAuthStateError>

    readonly consume: (state: string) => Effect.Effect<OAuthStateEntry | undefined, OAuthStateError>

    readonly clear: () => Effect.Effect<void, OAuthStateError>
  }
>() {}
