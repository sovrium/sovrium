/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { InTransactionRuleJudge } from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type { AccountReference } from '@/application/ports/repositories/tables/record-write-accounts'
import type {
  BusinessRuleViolationError,
  NotFoundError,
  DatabaseError,
  UniqueConstraintViolationError,
  ValidationError,
} from '@/domain/errors'
import type { Effect } from 'effect'

/** Why a batch restore fails: a missing id, a unique value a live record holds, a rule, or the database. */
export type BatchRestoreError =
  DatabaseError | NotFoundError | UniqueConstraintViolationError | BusinessRuleViolationError

/**
 * Batch validation error — a batch the repository refused before writing
 * (a missing record, a malformed upsert). Declared here, beside the port, so
 * the use-cases and the live repository share one class.
 */
export class BatchValidationError extends Data.TaggedError('BatchValidationError')<{
  readonly message: string
  readonly details?: readonly string[]
}> {}

/**
 * One record's many-to-many links in a batch create (the many-to-many junction-write rule: a many-to-many
 * field has no base column, so its values travel beside the record's fields).
 */
export interface BatchCreateLink {
  readonly relatedTable: string
  readonly relatedIds: readonly (string | number)[]
  readonly linkTable: string
  readonly mirrorLinkTable?: string | undefined
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
export class BatchRepository extends Context.Service<
  BatchRepository,
  {
    /**
     * Create every record, and write `links[i]` — record `i`'s many-to-many
     * links — to the junction in the SAME transaction, so a link that cannot be
     * written leaves no record behind. `accounts` are confirmed in that
     * transaction ({@link AccountReference}), as by every batch write below.
     */
    readonly batchCreate: (
      session: Readonly<UserSession>,
      tableName: string,
      recordsData: readonly Record<string, unknown>[],
      written?: {
        readonly links?: readonly (readonly BatchCreateLink[])[] | undefined
        readonly accounts?: readonly AccountReference[]
      }
    ) => Effect.Effect<readonly Record<string, unknown>[], DatabaseError | ValidationError>

    /**
     * Update every record in one transaction. `judge` is the table's business
     * rules, judged inside it on the rows as they stand there
     * ({@link InTransactionRuleJudge}): a refusal writes none of them.
     */
    readonly batchUpdate: (
      session: Readonly<UserSession>,
      tableName: string,
      updates: readonly {
        readonly id: string
        readonly fields?: Record<string, unknown>
      }[],
      written?: {
        readonly accounts?: readonly AccountReference[] | undefined
        readonly judge?: InTransactionRuleJudge | undefined
        /** Columns written only while empty (signatures): a filled one refuses the batch. */
        readonly writeOnce?: readonly string[] | undefined
      }
    ) => Effect.Effect<
      readonly Record<string, unknown>[],
      DatabaseError | ValidationError | BusinessRuleViolationError
    >

    /** Delete every record in one transaction, the rules judged inside it as for `batchUpdate`. */
    readonly batchDelete: (
      session: Readonly<UserSession>,
      tableName: string,
      recordIds: readonly string[],
      options?: {
        readonly permanent?: boolean | undefined
        readonly judge?: InTransactionRuleJudge | undefined
      }
    ) => Effect.Effect<number, DatabaseError | BusinessRuleViolationError>

    /**
     * Bring every record back from the trash in one transaction, the rules
     * judged inside it on the trashed rows as they will stand restored
     * ({@link InTransactionRuleJudge}): a refusal restores none of them.
     */
    readonly batchRestore: (
      session: Readonly<UserSession>,
      tableName: string,
      recordIds: readonly string[],
      options?: { readonly judge?: InTransactionRuleJudge | undefined }
    ) => Effect.Effect<number, BatchRestoreError>

    readonly upsert: (
      session: Readonly<UserSession>,
      tableName: string,
      recordsData: readonly Record<string, unknown>[],
      options: {
        readonly fieldsToMergeOn: readonly string[]
        /**
         * Columns written when a row is inserted and never when a matched row
         * is updated: the creation date and the created-by author. A row is
         * created once, so an update must not rewrite either.
         */
        readonly insertOnlyFields?: readonly string[]
        /**
         * Rows the caller's row-level read rule hides. None is ever a match: a
         * record matching only these is created, and they are left untouched.
         */
        readonly hiddenIds?: readonly string[]
        readonly accounts?: readonly AccountReference[]
        /**
         * The rules, judged inside the transaction on every upsert row, as a
         * batch update's are ({@link InTransactionRuleJudge}) — except that
         * its rows are keyed by the POSITION of the upsert row (`'0'`, `'1'`…),
         * since which record a row matches is only known there: the record a
         * row matches under its position, and the row a row matching none
         * will insert under `upsertCreateKey`, judged as a create. A refusal
         * writes none of the upsert's rows, the rows it would have created
         * included.
         */
        readonly judge?: InTransactionRuleJudge | undefined
        /** Columns a matched row has written only while empty (signatures), as on `batchUpdate`. */
        readonly writeOnce?: readonly string[] | undefined
      }
    ) => Effect.Effect<
      UpsertResult,
      DatabaseError | BatchValidationError | ValidationError | BusinessRuleViolationError
    >
  }
>()('BatchRepository') {}
