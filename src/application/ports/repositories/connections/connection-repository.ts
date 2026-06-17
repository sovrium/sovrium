/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class ConnectionDatabaseError extends Data.TaggedError('ConnectionDatabaseError')<{
  readonly cause: unknown
}> {}

export class ConnectionRepository extends Context.Tag('ConnectionRepository')<
  ConnectionRepository,
  {
    readonly findById: (
      id: string
    ) => Effect.Effect<Record<string, unknown> | undefined, ConnectionDatabaseError>
    readonly findByName: (
      name: string
    ) => Effect.Effect<Record<string, unknown> | undefined, ConnectionDatabaseError>
    readonly list: () => Effect.Effect<readonly Record<string, unknown>[], ConnectionDatabaseError>
    readonly create: (input: {
      readonly name: string
      readonly provider: string
      readonly type: string
      readonly credentials: Record<string, unknown>
      readonly metadata?: Record<string, unknown>
      readonly createdById?: string
    }) => Effect.Effect<Record<string, unknown>, ConnectionDatabaseError>
    readonly upsertByName: (input: {
      readonly name: string
      readonly provider: string
      readonly type: string
      readonly credentials: Record<string, unknown>
      readonly metadata?: Record<string, unknown>
      readonly createdById?: string
    }) => Effect.Effect<Record<string, unknown>, ConnectionDatabaseError>
    readonly update: (
      id: string,
      data: Record<string, unknown>
    ) => Effect.Effect<Record<string, unknown>, ConnectionDatabaseError>
    readonly delete: (id: string) => Effect.Effect<void, ConnectionDatabaseError>
  }
>() {}
