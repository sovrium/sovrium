/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for automation state operations.
 */
export class AutomationStateDatabaseError extends Data.TaggedError('AutomationStateDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * One row of `system.automation_state` as returned by `list`.
 */
export interface AutomationStateEntry {
  readonly key: string
  readonly value: unknown
}

/**
 * Automation State Repository Port.
 *
 * Backs the `state:*` action operators (set, get, list, delete, increment).
 * All methods are scoped by `automationId` (FK to `system.automation_definitions.id`)
 * — the unique index on `(automation_id, key)` enforces upsert semantics.
 *
 * `ttlMs`, when provided to `set`, is added to `now()` to compute the
 * absolute `ttl` timestamp stored in the column. `get` filters out rows
 * whose `ttl` is in the past (lazy expiration); a background sweep is out
 * of scope for now.
 */
export class AutomationStateRepository extends Context.Tag('AutomationStateRepository')<
  AutomationStateRepository,
  {
    readonly set: (input: {
      readonly automationId: string
      readonly key: string
      readonly value: unknown
      readonly ttlMs?: number
    }) => Effect.Effect<void, AutomationStateDatabaseError>
    readonly get: (input: {
      readonly automationId: string
      readonly key: string
    }) => Effect.Effect<unknown, AutomationStateDatabaseError>
    readonly list: (input: {
      readonly automationId: string
      readonly prefix: string
    }) => Effect.Effect<readonly AutomationStateEntry[], AutomationStateDatabaseError>
    readonly delete: (input: {
      readonly automationId: string
      readonly key: string
    }) => Effect.Effect<void, AutomationStateDatabaseError>
    readonly increment: (input: {
      readonly automationId: string
      readonly key: string
      readonly amount: number
    }) => Effect.Effect<number, AutomationStateDatabaseError>
  }
>() {}
