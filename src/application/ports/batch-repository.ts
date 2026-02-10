/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { UserSession } from './user-session'
import type { ForbiddenError, SessionContextError, ValidationError } from '@/domain/errors'
import type { Effect } from 'effect'

/**
 * Batch validation error interface
 *
 * Structurally compatible with infrastructure's BatchValidationError
 * (Data.TaggedError). Defined here so application layer doesn't need
 * to import from infrastructure.
 */
export interface BatchValidationError extends Error {
  readonly _tag: 'BatchValidationError'
  readonly message: string
  readonly details?: readonly string[]
}

/**
 * Upsert operation result
 */
export interface UpsertResult {
  readonly records: readonly Record<string, unknown>[]
  readonly created: number
  readonly updated: number
}

/**
 * Batch Repository port for batch operations
 *
 * Defines the contract for bulk create, update, delete, restore, and upsert.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const batch = yield* BatchRepository
 *   const result = yield* batch.batchCreate(session, 'users', records)
 * })
 * ```
 */
export class BatchRepository extends Context.Tag('BatchRepository')<
  BatchRepository,
  {
    readonly batchCreate: (
      session: Readonly<UserSession>,
      tableName: string,
      recordsData: readonly Record<string, unknown>[]
    ) => Effect.Effect<readonly Record<string, unknown>[], SessionContextError>

    readonly batchUpdate: (
      session: Readonly<UserSession>,
      tableName: string,
      updates: readonly {
        readonly id: string
        readonly fields?: Record<string, unknown>
      }[]
    ) => Effect.Effect<readonly Record<string, unknown>[], SessionContextError | ValidationError>

    readonly batchDelete: (
      session: Readonly<UserSession>,
      tableName: string,
      recordIds: readonly string[],
      permanent?: boolean
    ) => Effect.Effect<number, SessionContextError>

    readonly batchRestore: (
      session: Readonly<UserSession>,
      tableName: string,
      recordIds: readonly string[]
    ) => Effect.Effect<number, SessionContextError | ForbiddenError>

    readonly upsert: (
      session: Readonly<UserSession>,
      tableName: string,
      recordsData: readonly Record<string, unknown>[],
      fieldsToMergeOn: readonly string[]
    ) => Effect.Effect<UpsertResult, SessionContextError | BatchValidationError | ValidationError>
  }
>() {}
