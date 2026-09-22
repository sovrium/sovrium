/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import {
  type DatabaseError,
  type ValidationError,
  type DrizzleTransaction,
} from '@/infrastructure/database'
import { buildInsertClauses, insertAndResolveRow } from '../mutation-helpers/create-record-helpers'
import { wrapWriteStatementError } from '../statement/error-handling'

/**
 * Batch validation error - returned when batch validation fails
 */
export class BatchValidationError extends Data.TaggedError('BatchValidationError')<{
  readonly message: string
  readonly details?: readonly string[]
}> {}

/**
 * Width of every per-record fan-out inside a batch transaction.
 *
 * Why a ceiling at all — these fan-outs are **input-size bounded**: the width
 * is `recordsData.length` / `recordIds.length`, i.e. a number the CALLER
 * chooses. That is the dangerous class. A raw `Promise.all` over them makes the
 * width unrepresentable (there is no argument to set), so a 500-record batch
 * silently became a 500-wide fan-out.
 *
 * Why 2 and not larger — every statement in these fan-outs runs on the
 * transaction handle (`tx`), which is ONE reserved connection on both dialects
 * (`bun:sql` reserves a pooled connection for `db.transaction`; `bun:sqlite` is
 * a single embedded handle). The driver therefore serialises them regardless,
 * so width beyond a small pipelining window buys no parallelism — only an
 * unbounded queue of in-flight statements held against that one connection for
 * the whole transaction. Two keeps the round-trip pipelining that actually
 * helps and matches the DB-bound precedent in
 * `infrastructure/database/views/view-generators.ts` and
 * `infrastructure/database/repositories/tables/tables-overview-repository-live.ts`.
 *
 * Note this is a DIFFERENT risk from the 2026-07-25 pool-exhaustion incident:
 * because the work rides the transaction's own connection, it cannot starve the
 * shared pool. The bound here is about queue depth and connection hold time.
 *
 * `Effect.all` preserves array order exactly as `Promise.all` does, which the
 * callers rely on — `batch-delete` / `batch-restore` report the FIRST failing
 * `recordId` by array position, not by completion order.
 *
 * @public
 */
export const BATCH_FANOUT_CONCURRENCY = 2

/**
 * Build INSERT SQL clauses from a fields object, or `undefined` when empty.
 *
 * Delegates clause construction to the SINGLE-record builder
 * (`buildInsertClauses` in `mutation-helpers/create-record-helpers`) so both
 * write paths encode values identically. The batch path previously carried its
 * own copy that bound every value with `sql\`${value}\``, and drizzle expands a
 * JS array into a SQL ROW CONSTRUCTOR — `['a','b']` was emitted as `($2, $3)`.
 * That made array-valued fields (`multi-select`, `multiple-attachments`, any
 * JSON column holding an array) fail arity-dependently rather than
 * type-dependently: two or more elements raised a row-constructor error, while
 * a ONE-element array bound to `($2)` — legal scalar syntax — so SQLite
 * answered 201 and silently stored the bare scalar where the array belonged.
 *
 * The shared builder introspects the column type via `arrayColumnTypes` and
 * emits a native array literal for a genuine SQL array or a JSON literal
 * otherwise, which is why callers resolve that map first (see
 * `collectArrayColumnNames` / `lookupArrayColumnTypes`).
 *
 * Only the empty-fields guard stays local: batch callers treat "no fields" as
 * a skipped record rather than an error.
 */
function buildBatchInsertClauses(
  fields: Readonly<Record<string, unknown>>,
  arrayColumnTypes: Readonly<Record<string, string>>
): InsertClauses | undefined {
  if (Object.keys(fields).length === 0) return undefined
  return buildInsertClauses(fields, arrayColumnTypes)
}

/** The clause pair the shared builder produces, named once for reuse below. */
type InsertClauses = ReturnType<typeof buildInsertClauses>

/**
 * Run the batch INSERT and return the row it wrote, or `undefined` when the
 * statement produced none.
 *
 * The single place the batch INSERT is performed. The two create helpers below
 * call exactly it and differ ONLY in how a failure surfaces — one throws, one
 * fails an Effect — so holding the statement here stops the two spellings from
 * drifting the way the clause BUILDERS did (see {@link buildBatchInsertClauses}
 * for what that cost).
 *
 * It delegates to `insertAndResolveRow`, the same helper the single-record
 * create path uses, which is what makes the returned row USABLE on a
 * view-backed table. A table carrying a rollup / lookup / count is materialised
 * as a VIEW with an `INSTEAD OF INSERT` trigger, and `RETURNING *` on that view
 * yields the trigger's `NEW` row — whose primary key never materialises. This
 * helper previously ran the raw statement itself, so a batch create with
 * `returnRecords: true` handed back `id: null`, serialised on the wire as the
 * string `"null"`. The batch answered 201 and the rows were written correctly,
 * so nothing looked wrong until an importer used those ids to link the new rows
 * to something and either wrote the text "null" into a foreign key or failed on
 * its next request. Upsert's create branch reaches this same helper and was
 * handing back the same unusable id.
 *
 * Clause construction deliberately stays at the call sites: the two helpers
 * place it on opposite sides of their error boundary, so a rejected column name
 * is a raw throw from one and a `ValidationError` from the other. Hoisting it in
 * here would quietly unify that, which is a behaviour change, not a cleanup.
 */
async function executeInsertReturning(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  clauses: InsertClauses
): Promise<Readonly<Record<string, unknown>> | undefined> {
  const row = await insertAndResolveRow(tx, tableName, clauses.columnsClause, clauses.valuesClause)
  // `insertAndResolveRow` normalises "no row returned" to `{}`; batch callers
  // treat that case as "nothing was created", so map it back to `undefined`.
  // A successful INSERT always returns every column, so an empty object can
  // only mean the statement produced no row.
  return Object.keys(row).length === 0 ? undefined : row
}

/**
 * Handle a failed batch INSERT.
 *
 * Delegates to the shared write-statement handler, so batch create, batch
 * update and upsert's create branch (which reaches this via
 * {@link createSingleRecord}) all answer a rejected write identically. They
 * previously carried two independent copies of the same wrap, and both echoed
 * the driver's own text to the client — see {@link wrapWriteStatementError} for
 * what that disclosed and why its guards never fired.
 */
const handleInsertError = wrapWriteStatementError('Failed to insert a batch record')

/**
 * Helper to create a single record within a transaction
 */
export async function createSingleRecord(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>,
  arrayColumnTypes: Readonly<Record<string, string>>
): Promise<Readonly<Record<string, unknown>> | undefined> {
  const clauses = buildBatchInsertClauses(fields, arrayColumnTypes)
  if (!clauses) return undefined

  try {
    return await executeInsertReturning(tx, tableName, clauses)
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for error propagation
    throw handleInsertError(error)
  }
}

/**
 * Effect-based helper to create a single record within a batch operation
 *
 * This is the Effect version of createSingleRecord, used by batchCreateRecords
 * to properly propagate ValidationError through Effect.reduce.
 */
export function createSingleRecordInBatch(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>,
  arrayColumnTypes: Readonly<Record<string, string>>
): Effect.Effect<Record<string, unknown> | undefined, DatabaseError | ValidationError> {
  return Effect.tryPromise({
    try: async () => {
      const clauses = buildBatchInsertClauses(fields, arrayColumnTypes)
      if (!clauses) return undefined

      return await executeInsertReturning(tx, tableName, clauses)
    },
    catch: handleInsertError,
  })
}
