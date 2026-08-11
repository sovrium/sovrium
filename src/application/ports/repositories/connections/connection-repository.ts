/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for connection operations.
 */
export class ConnectionDatabaseError extends Data.TaggedError('ConnectionDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Connection Repository Port.
 *
 * Backs `system.connections` — the catalogue of OAuth/API integrations
 * an automation can call. Connections are app-scoped (created by an
 * admin); per-user tokens are stored separately in `connection_tokens`
 * via {@link ../connection-token-repository}.
 */
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
    /**
     * Atomically resolve-or-create a connection row keyed on `name`.
     * Backed by INSERT ... ON CONFLICT (name) DO UPDATE so two concurrent
     * first-authorize requests for the same connection both succeed and
     * resolve to the same row (audit H3). Returns the resulting row.
     */
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
