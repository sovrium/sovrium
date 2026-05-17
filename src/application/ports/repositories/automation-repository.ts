/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for automation operations
 */
export class AutomationDatabaseError extends Data.TaggedError('AutomationDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Automation Repository Port
 *
 * Provides type-safe database operations for automation definitions.
 * Implementation lives in infrastructure layer.
 */
export class AutomationRepository extends Context.Tag('AutomationRepository')<
  AutomationRepository,
  {
    readonly findById: (
      id: string
    ) => Effect.Effect<Record<string, unknown> | undefined, AutomationDatabaseError>
    readonly findByName: (
      name: string
    ) => Effect.Effect<Record<string, unknown> | undefined, AutomationDatabaseError>
    readonly list: () => Effect.Effect<readonly Record<string, unknown>[], AutomationDatabaseError>
    readonly create: (definition: {
      readonly name: string
      readonly trigger: Record<string, unknown>
      readonly actions: readonly Record<string, unknown>[]
      readonly enabled?: boolean
    }) => Effect.Effect<Record<string, unknown>, AutomationDatabaseError>
    readonly update: (
      id: string,
      data: Record<string, unknown>
    ) => Effect.Effect<Record<string, unknown>, AutomationDatabaseError>
    readonly delete: (id: string) => Effect.Effect<void, AutomationDatabaseError>
  }
>() {}
