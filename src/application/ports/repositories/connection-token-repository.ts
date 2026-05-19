/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class ConnectionTokenDatabaseError extends Data.TaggedError('ConnectionTokenDatabaseError')<{
  readonly cause: unknown
}> {}

export class SentinelTokenInProductionError extends Data.TaggedError(
  'SentinelTokenInProductionError'
)<{
  readonly connectionId: string
  readonly userId: string
}> {}

export interface ConnectionTokenPlaintext {
  readonly id: string
  readonly connectionId: string
  readonly userId: string
  readonly accessToken: string
  readonly refreshToken: string | undefined
  readonly expiresAt: Date | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface ConnectionUserSummary {
  readonly userId: string
  readonly expiresAt: Date | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

export class ConnectionTokenRepository extends Context.Tag('ConnectionTokenRepository')<
  ConnectionTokenRepository,
  {
    readonly findForUser: (input: {
      readonly connectionId: string
      readonly userId: string
    }) => Effect.Effect<ConnectionTokenPlaintext | undefined, ConnectionTokenDatabaseError>
    readonly upsertForUser: (input: {
      readonly connectionId: string
      readonly userId: string
      readonly accessToken: string
      readonly refreshToken?: string
      readonly expiresAt?: Date
    }) => Effect.Effect<
      ConnectionTokenPlaintext,
      ConnectionTokenDatabaseError | SentinelTokenInProductionError
    >
    readonly deleteForUser: (input: {
      readonly connectionId: string
      readonly userId: string
    }) => Effect.Effect<boolean, ConnectionTokenDatabaseError>
    readonly countForConnection: (
      connectionId: string
    ) => Effect.Effect<number, ConnectionTokenDatabaseError>
    readonly listUsersForConnection: (input: {
      readonly connectionId: string
    }) => Effect.Effect<readonly ConnectionUserSummary[], ConnectionTokenDatabaseError>
  }
>() {}
