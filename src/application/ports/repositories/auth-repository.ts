/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class AuthDatabaseError extends Data.TaggedError('AuthDatabaseError')<{
  readonly cause: unknown
}> {}

export class AuthRepository extends Context.Tag('AuthRepository')<
  AuthRepository,
  {
    readonly verifyUserEmail: (userId: string) => Effect.Effect<void, AuthDatabaseError>
    readonly findUserEmailById: (
      userId: string
    ) => Effect.Effect<string | undefined, AuthDatabaseError>
    readonly getUserRole: (userId: string) => Effect.Effect<string | undefined, AuthDatabaseError>
    readonly updateUserRole: (
      userId: string,
      role: string
    ) => Effect.Effect<void, AuthDatabaseError>
    readonly getUserSessionToken: (
      userId: string
    ) => Effect.Effect<string | undefined, AuthDatabaseError>
    readonly countUsers: () => Effect.Effect<number, AuthDatabaseError>
  }
>() {}
