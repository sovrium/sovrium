/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  reportCommittedRows,
  type CommittedRowChange,
} from '@/application/ports/services/record-change-feed'
import {
  type ValidationError,
  type DrizzleTransaction,
  type DatabaseError,
} from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { withOutboxTransaction } from '@/infrastructure/webhooks/webhook-outbox-queries'
import { injectUpdateAuthorship } from '../mutation-helpers/authorship-helpers'
import { encodeColumnValue } from '../mutation-helpers/column-value-encoding'
import { fetchRecordsByIds } from '../mutation-helpers/record-fetch-helpers'
import { logCommittedRowChanges } from '../query-helpers/activity-log-helpers'
import {
  wrapDatabaseErrorWithValidation,
  wrapWriteStatementError,
} from '../statement/error-handling'
import { databaseTableName, tableIdentifier, validateColumnName } from '../statement/validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * A batch update as ONE set-based write.
 *
 * Writing record by record cost four to five statements per record (an
 * authorship probe, the before-state read, the UPDATE, the SQLite re-read, the
 * audit entry), so a full batch of 100 issued about 500. Every one of those is
 * a question about the whole batch, so each is now asked once: one authorship
 * probe, one column-type read, one before-state read, one `UPDATE … SET col =
 * CASE id WHEN … END … WHERE id IN (…)`, one re-read on SQLite and one
 * multi-row audit insert — the same statements for 1 record as for 100.
 *
 * Semantics are unchanged: the write is all-or-nothing (one transaction, and a
 * single statement fails as a whole), an id that matches no row is skipped, and
 * the rows are logged and announced only after the commit.
 */

type BatchUpdate = { readonly id: string; readonly fields?: Record<string, unknown> }

/** One record's update after merging: its id and every column it writes. */
type MergedUpdate = { readonly id: string; readonly fields: Readonly<Record<string, unknown>> }

/**
 * The updates that write something, one per id. An id named twice is written
 * once with both field sets merged, the later winning — the same result as
 * applying the two in order.
 */
const mergeUpdates = (updates: readonly BatchUpdate[]): readonly MergedUpdate[] => {
  const named = updates.filter((update) => Object.keys(update.fields ?? {}).length > 0)
  return [...Map.groupBy(named, (update) => String(update.id)).entries()].map(([id, entries]) => ({
    id,
    fields: entries.reduce<Readonly<Record<string, unknown>>>(
      (acc, entry) => ({ ...acc, ...entry.fields }),
      {}
    ),
  }))
}

/**
 * PostgreSQL type of each written column, as `format_type` spells it. A `CASE`
 * over bound values takes its type from its branches, so each value is cast to
 * its column's type; a single-row `SET col = $1` got that conversion from the
 * assignment for free. SQLite is typeless and needs none.
 */
const readColumnTypes = async (
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  columns: readonly string[]
): Promise<Readonly<Record<string, string>>> => {
  if (isSqliteRuntime() || columns.length === 0) return {}
  const names = sql.join(
    columns.map((column) => sql`${column}`),
    sql.raw(', ')
  )
  const rows = await executeRaw(
    tx,
    sql`SELECT a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS column_type
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relname = ${databaseTableName(tableName)}
          AND a.attnum > 0 AND NOT a.attisdropped
          AND a.attname IN (${names})`
  )
  return Object.fromEntries(
    rows.map((row) => [String(row['column_name']), String(row['column_type'])])
  )
}

/** One value as it is written to its column: encoded, then cast to the column's type where known. */
const typedValue = (value: unknown, columnType: string | undefined): Readonly<SQL> => {
  const encoded = encodeColumnValue(value, columnType?.endsWith('[]') ? 'ARRAY' : undefined)
  // sql-literal: keyword -- a type name PostgreSQL's own format_type() returned
  return columnType === undefined ? encoded : sql`CAST(${encoded} AS ${sql.raw(columnType)})`
}

/** `col = CASE id WHEN … THEN … ELSE col END` for every written column. */
const buildSetClause = (
  updates: readonly MergedUpdate[],
  columns: readonly string[],
  columnTypes: Readonly<Record<string, string>>
): Readonly<SQL> =>
  sql.join(
    columns.map((column) => {
      validateColumnName(column)
      const whens = updates
        .filter((update) => Object.hasOwn(update.fields, column))
        .map(
          (update) =>
            sql`WHEN ${update.id} THEN ${typedValue(update.fields[column], columnTypes[column])}`
        )
      const target = sql.identifier(column)
      return sql`${target} = CASE ${sql.identifier('id')} ${sql.join(whens, sql.raw(' '))} ELSE ${target} END`
    }),
    sql.raw(', ')
  )

/** `id IN (…)` over a list of ids, each bound. */
const idList = (ids: readonly unknown[]): Readonly<SQL> =>
  sql.join(
    ids.map((id) => sql`${id}`),
    sql.raw(', ')
  )

/**
 * The UPDATE itself, answering the rows as a read right after it sees them.
 * SQLite's `RETURNING` reports a row before its `AFTER` triggers (formulas,
 * `updated_at`) ran, so the batch is read again in one statement there;
 * PostgreSQL's already reflects its `BEFORE` triggers.
 */
const updateRows = async (
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  updates: readonly MergedUpdate[]
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  const columns = [...new Set(updates.flatMap((update) => Object.keys(update.fields)))]
  const columnTypes = await readColumnTypes(tx, tableName, columns)
  const setClause = buildSetClause(updates, columns, columnTypes)
  const returned = await executeRaw(
    tx,
    sql`UPDATE ${tableIdentifier(tableName)} SET ${setClause} WHERE id IN (${idList(updates.map((u) => u.id))}) RETURNING *`
  )
  if (!isSqliteRuntime() || returned.length === 0) return returned
  return executeRaw(
    tx,
    sql`SELECT * FROM ${tableIdentifier(tableName)} WHERE id IN (${idList(returned.map((row) => row['id']))})`
  )
}

/** Write every update in one statement and answer the committed changes, in request order. */
const writeBatch = (
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  session: Readonly<Session>,
  merged: readonly MergedUpdate[]
): Effect.Effect<readonly CommittedRowChange[], DatabaseError | ValidationError> =>
  Effect.gen(function* () {
    const onFailure = wrapWriteStatementError(`Failed to update a batch of records in ${tableName}`)
    const authorship = yield* Effect.tryPromise({
      try: () => injectUpdateAuthorship({}, session.userId, tx, tableName),
      catch: onFailure,
    })
    const updates = merged.map((update) => ({
      id: update.id,
      fields: { ...update.fields, ...authorship },
    }))
    const before = yield* fetchRecordsByIds(
      tx,
      tableName,
      updates.map((update) => update.id)
    )
    const after = yield* Effect.tryPromise({
      try: () => updateRows(tx, tableName, updates),
      catch: onFailure,
    })
    const previousById = new Map(before.map((row) => [String(row['id']), row] as const))
    const rowById = new Map(after.map((row) => [String(row['id']), { ...row }] as const))
    return updates.flatMap((update): readonly CommittedRowChange[] => {
      const row = rowById.get(update.id)
      return row === undefined
        ? []
        : [
            {
              tableName,
              event: 'update',
              recordId: update.id,
              row,
              previous: previousById.get(update.id),
            },
          ]
    })
  })

/**
 * Batch update records
 *
 * Updates multiple records in one transaction and one statement. Records the
 * caller may not update never reach here (the route drops them); an id that
 * matches no row is skipped.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param updates - Array of records with id and fields to update (requires nested format)
 * @returns Effect resolving to array of updated records
 */
export function batchUpdateRecords(
  session: Readonly<Session>,
  tableName: string,
  updates: readonly BatchUpdate[]
): Effect.Effect<readonly Record<string, unknown>[], DatabaseError | ValidationError> {
  return Effect.gen(function* () {
    const merged = mergeUpdates(updates)
    const committed =
      merged.length === 0
        ? []
        : yield* withOutboxTransaction((changes: readonly CommittedRowChange[]) => changes)(
            (tx) => writeBatch(tx, tableName, session, merged),
            wrapDatabaseErrorWithValidation(`Failed to batch update records in ${tableName}`)
          )
    // Logged and reported once the transaction has committed — a rolled-back
    // batch changed nothing.
    yield* logCommittedRowChanges(session, committed)
    yield* reportCommittedRows(committed)
    return committed.flatMap((change) => (change.row === undefined ? [] : [{ ...change.row }]))
  })
}
