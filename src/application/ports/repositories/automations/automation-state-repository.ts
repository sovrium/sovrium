/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class AutomationStateDatabaseError extends Data.TaggedError('AutomationStateDatabaseError')<{
  readonly cause: unknown
}> {}

export interface AutomationStateEntry {
  readonly key: string
  readonly value: unknown
}

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
