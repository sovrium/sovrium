/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE path each bulk write takes — batch create, batch update, batch
 * delete — with the side effects it carries, whichever door it came through:
 * the records API's batch endpoints (which the grid's CSV import posts to) and
 * the native bulk forms.
 *
 * A bulk write carries fewer side effects than a single-record one — no
 * record-event automations, no webhooks — and the order of the ones it does
 * carry is fixed, and the unit tests pin it:
 *
 *  - create: merge the SQLite AI-compute baseline into every row, then write
 *  - update: write, then signal the AI columns the caller wrote by hand, detached
 *  - delete: write; a failure is logged, then reported as the write's own error
 *
 * The realtime change events are the batch programs' own: each announces the
 * rows it wrote once its write commits.
 */

import { Effect } from 'effect'
import {
  markUserAuthoredAiFieldsForRecords,
  type AiComputeBatchWrite,
} from '@/application/use-cases/ai-compute/enqueue-refinement'
import { logError } from '@/infrastructure/logging/logger'
import { batchCreateProgram, batchDeleteProgram, batchUpdateProgram } from './batch-operations'
import { mergeCreateAiBaseline } from './record-create-orchestration'
import type { LinkReader } from './linked-row-visibility'
import type { StoredRow } from './record-update-orchestration'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'

/** The caller and the table one bulk write addresses. */
interface BatchScope {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly tableName: string
}

/** A bulk write that echoes the records it wrote. */
interface EchoingBatch extends BatchScope {
  readonly returnRecords?: boolean
  /** Whose read rules judge the rows the batch links to. */
  readonly linkReader: LinkReader
}

/** The batch create's write, over the rows as they reach the database. */
export interface BatchCreateSteps<A, E, R> {
  readonly write: (rows: readonly StoredRow[]) => Effect.Effect<A, E, R>
}

/**
 * The batch create, over an abstract write: every row carries the SQLite
 * AI-compute baseline PostgreSQL computes in a BEFORE trigger, in the SAME
 * insert. No-op on PostgreSQL and for tables without AI-compute fields.
 */
export function orchestrateBatchCreate<A, E, R>(
  input: { readonly app: App; readonly tableName: string; readonly isSqlite: boolean },
  rows: readonly StoredRow[],
  steps: BatchCreateSteps<A, E, R>
): Effect.Effect<A, E, R> {
  return steps
    .write(rows.map((fields) => mergeCreateAiBaseline(input, fields, input.isSqlite)))
    .pipe(
      Effect.withSpan('tables.orchestrate-batch-create', {
        attributes: { tableName: input.tableName },
      })
    )
}

/** Create a batch of records and run the side effects a batch create carries. */
export function batchCreateWithSideEffects(
  input: EchoingBatch & {
    /** The validated fields of each row, as the caller asked to write them. */
    readonly rows: readonly StoredRow[]
    readonly isSqlite: boolean
  }
) {
  const { session, app, tableName, linkReader } = input
  return orchestrateBatchCreate(input, input.rows, {
    write: (rows) =>
      batchCreateProgram({
        ...{ session, tableName, app, linkReader },
        recordsData: rows.map((row) => ({ ...row })),
        ...(input.returnRecords === undefined ? {} : { returnRecords: input.returnRecords }),
      }),
  }).pipe(Effect.withSpan('tables.batch-create-with-side-effects', { attributes: { tableName } }))
}

/** The batch update's steps. */
export interface BatchUpdateSteps<A, E, R, RSignal> {
  readonly write: Effect.Effect<A, E, R>
  readonly signalAiCompute: Effect.Effect<void, never, RSignal>
}

/**
 * The batch update, over abstract steps: once the rows are written, any AI
 * column the caller wrote by hand stops being reported as a failed computed
 * fallback. A failed write signals nothing.
 */
export function orchestrateBatchUpdate<A, E, R, RSignal>(
  tableName: string,
  steps: BatchUpdateSteps<A, E, R, RSignal>
): Effect.Effect<A, E, R | RSignal> {
  return steps.write.pipe(
    Effect.tap(() => steps.signalAiCompute),
    Effect.withSpan('tables.orchestrate-batch-update', { attributes: { tableName } })
  )
}

/** Update a batch of records and run the side effects a batch update carries. */
export function batchUpdateWithSideEffects(
  input: EchoingBatch & {
    /** Each record's id paired with exactly the fields the caller may write. */
    readonly records: readonly (AiComputeBatchWrite & { readonly id: string })[]
  }
) {
  const { session, app, tableName, linkReader, records } = input
  return orchestrateBatchUpdate(tableName, {
    write: batchUpdateProgram({
      ...{ session, tableName, app, linkReader },
      recordsData: records.map((record) => ({ id: record.id, fields: { ...record.fields } })),
      ...(input.returnRecords === undefined ? {} : { returnRecords: input.returnRecords }),
    }),
    // Detached: the status writes outlive the request, and read the same
    // services this program was provided.
    signalAiCompute: Effect.asVoid(
      Effect.forkDetach(markUserAuthoredAiFieldsForRecords({ app, tableName, records }))
    ),
  }).pipe(Effect.withSpan('tables.batch-update-with-side-effects', { attributes: { tableName } }))
}

/** The batch delete's steps. */
export interface BatchDeleteSteps<A, E, R> {
  readonly write: Effect.Effect<A, E, R>
  readonly reportFailure: (error: E) => Effect.Effect<void>
}

/** The batch delete, over abstract steps: a failure is reported, then kept. */
export function orchestrateBatchDelete<A, E, R>(
  tableName: string,
  steps: BatchDeleteSteps<A, E, R>
): Effect.Effect<A, E, R> {
  return steps.write.pipe(
    Effect.tapError(steps.reportFailure),
    Effect.withSpan('tables.orchestrate-batch-delete', { attributes: { tableName } })
  )
}

/** Delete a batch of records — to the trash, or for good — and log a failure. */
export function batchDeleteWithSideEffects(
  input: BatchScope & { readonly ids: readonly string[]; readonly permanent: boolean }
) {
  const { session, app, tableName, ids, permanent } = input
  return orchestrateBatchDelete(tableName, {
    write: batchDeleteProgram(session, tableName, ids, { permanent, app }),
    reportFailure: (error) =>
      Effect.sync(() =>
        logError(`[tables] batch ${permanent ? 'hard-' : 'soft-'}delete failed`, error)
      ),
  }).pipe(Effect.withSpan('tables.batch-delete-with-side-effects', { attributes: { tableName } }))
}
