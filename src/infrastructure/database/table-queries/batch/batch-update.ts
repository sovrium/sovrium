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
import { BusinessRuleViolationError } from '@/domain/errors'
import { signatureKeptRefusal } from '@/domain/models/app/tables/fields/field-types/media/signature-value-validation'
import { isLanguageMerge } from '@/domain/models/app/tables/translatable-write-service'
import { DatabaseError, type ValidationError, type PortableTx } from '@/infrastructure/database'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { languageMergeSql } from '@/infrastructure/database/sql/sql-translatable-writes'
import { withOutboxTransaction } from '@/infrastructure/webhooks/webhook-outbox-queries'
import { confirmBatchAccounts } from '../mutation-helpers/account-confirmation'
import { injectUpdateAuthorship } from '../mutation-helpers/authorship-helpers'
import { encodeColumnValue, givenEntries } from '../mutation-helpers/column-value-encoding'
import { fetchRecordsByIds } from '../mutation-helpers/record-fetch-helpers'
import { judgeInTransaction } from '../mutation-helpers/rule-judgement'
import { columnsAreEmpty } from '../mutation-helpers/update-helpers'
import { logCommittedRowChanges } from '../query-helpers/activity-log-helpers'
import {
  wrapDatabaseErrorWithValidation,
  wrapWriteStatementError,
} from '../statement/error-handling'
import { databaseTableName, tableIdentifier, validateColumnName } from '../statement/validation'
import type { InTransactionRuleJudge } from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type { AccountReference } from '@/application/ports/repositories/tables/record-write-accounts'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect, TransactionOn } from '@/infrastructure/database/drizzle/layer'

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
  tx: Readonly<PortableTx>,
  dialect: Dialect,
  tableName: string,
  columns: readonly string[]
): Promise<Readonly<Record<string, string>>> => {
  if (dialect.kind === 'sqlite' || columns.length === 0) return {}
  const names = sql.join(
    columns.map((column) => sql`${column}`),
    sql.raw(', ')
  )
  const rows = await executeRawOn(
    dialect.kind,
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

/**
 * One value as it is written to its column: encoded, then cast to the column's
 * type where known. A translatable field's write merges into its stored map.
 */
const typedValue = (
  dialect: DatabaseDialect,
  column: string,
  value: unknown,
  columnType: string | undefined
): Readonly<SQL> => {
  if (isLanguageMerge(value)) return languageMergeSql(dialect, column, value)
  const encoded = encodeColumnValue(
    dialect,
    value,
    columnType?.endsWith('[]') ? 'ARRAY' : undefined
  )
  // sql-literal: keyword -- a type name PostgreSQL's own format_type() returned
  return columnType === undefined ? encoded : sql`CAST(${encoded} AS ${sql.raw(columnType)})`
}

/** `col = CASE id WHEN … THEN … ELSE col END` for every written column. */
const buildSetClause = (
  dialect: DatabaseDialect,
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
            sql`WHEN ${update.id} THEN ${typedValue(dialect, column, update.fields[column], columnTypes[column])}`
        )
      const target = sql.identifier(column)
      return sql`${target} = CASE ${sql.identifier('id')} ${sql.join(whens, sql.raw(' '))} ELSE ${target} END`
    }),
    sql.raw(', ')
  )

/** An update filling columns it may fill only while they are empty (a signature's). */
type EmptyColumnsGuard = {
  readonly id: string
  readonly columns: readonly string[]
  /** The update's position in the batch, which its refusal names. */
  readonly index: number
}

/** The updates that fill a write-once column, each with the columns it fills. */
const emptyColumnsGuards = (
  updates: readonly MergedUpdate[],
  writeOnce: readonly string[]
): readonly EmptyColumnsGuard[] =>
  updates.flatMap((update, index) => {
    const columns = writeOnce.filter((column) => Object.hasOwn(update.fields, column))
    return columns.length === 0 ? [] : [{ id: update.id, columns, index }]
  })

/**
 * `AND NOT (…)`: a row whose write-once column is already filled is left out of
 * the UPDATE, so of two writes racing to fill it the second changes nothing.
 */
const excludeFilled = (guards: readonly EmptyColumnsGuard[]): Readonly<SQL> => {
  if (guards.length === 0) return sql``
  const filled = guards.map(
    ({ id, columns }) =>
      sql`(${sql.identifier('id')} = ${id} AND NOT (${columnsAreEmpty(columns)}))`
  )
  return sql` AND NOT (${sql.join(filled, sql.raw(' OR '))})`
}

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
  { tx, dialect }: TransactionOn,
  tableName: string,
  updates: readonly MergedUpdate[],
  guards: readonly EmptyColumnsGuard[]
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  const columns = [...new Set(updates.flatMap((update) => Object.keys(update.fields)))]
  if (columns.length === 0)
    throw new DatabaseError('Cannot update records with no fields', undefined)
  const columnTypes = await readColumnTypes(tx, dialect, tableName, columns)
  const setClause = buildSetClause(dialect.kind, updates, columns, columnTypes)
  const returned = await executeRawOn(
    dialect.kind,
    tx,
    sql`UPDATE ${tableIdentifier(tableName)} SET ${setClause} WHERE id IN (${idList(updates.map((u) => u.id))})${excludeFilled(guards)} RETURNING *`
  )
  if (dialect.kind !== 'sqlite' || returned.length === 0) return returned
  return executeRawOn(
    dialect.kind,
    tx,
    sql`SELECT * FROM ${tableIdentifier(tableName)} WHERE id IN (${idList(returned.map((row) => row['id']))})`
  )
}

/**
 * The refusal of a batch one of whose rows held a write-once column it would
 * fill: the row existed before the UPDATE and the UPDATE left it out.
 */
const filledRefusal = (
  guards: readonly EmptyColumnsGuard[],
  before: readonly Readonly<Record<string, unknown>>[],
  after: readonly Readonly<Record<string, unknown>>[]
): ValidationError | undefined => {
  const existed = new Map(before.map((row) => [String(row['id']), row] as const))
  const written = new Set(after.map((row) => String(row['id'])))
  const guard = guards.find(({ id }) => existed.has(id) && !written.has(id))
  if (guard === undefined) return undefined
  const held = existed.get(guard.id)
  const [first = ''] = guard.columns
  const filled = guard.columns.find((name) => held?.[name] !== null && held?.[name] !== undefined)
  return signatureKeptRefusal(filled ?? first, guard.index)
}

/** Write every update in one statement and answer the committed changes, in request order. */
const writeBatch = (
  { tx, dialect }: TransactionOn,
  tableName: string,
  session: Readonly<Session>,
  batch: { readonly merged: readonly MergedUpdate[]; readonly writeOnce: readonly string[] }
): Effect.Effect<readonly CommittedRowChange[], DatabaseError | ValidationError> =>
  Effect.gen(function* () {
    const onFailure = wrapWriteStatementError(`Failed to update a batch of records in ${tableName}`)
    const authorship = yield* Effect.tryPromise({
      try: () => injectUpdateAuthorship({}, session.userId, { tx, dialect }, tableName),
      catch: onFailure,
    })
    // A key whose value is `undefined` is not given: its column keeps the
    // stored value, as in every other write path (`givenEntries`).
    const updates = batch.merged.map((update) => ({
      id: update.id,
      fields: Object.fromEntries(givenEntries({ ...update.fields, ...authorship })),
    }))
    const guards = emptyColumnsGuards(updates, batch.writeOnce)
    const before = yield* fetchRecordsByIds(
      { tx, dialect },
      tableName,
      updates.map((update) => update.id)
    )
    const after = yield* Effect.tryPromise({
      try: () => updateRows({ tx, dialect }, tableName, updates, guards),
      catch: onFailure,
    })
    const refused = filledRefusal(guards, before, after)
    if (refused !== undefined) return yield* Effect.fail(refused)
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
 * The table's business rules, judged on every row of the batch as this
 * transaction reads it (`rule-judgement.ts`) — after the accounts, before any
 * row is written. A refusal fails the whole batch.
 */
const judgedBatch = (
  on: TransactionOn,
  tableName: string,
  updates: readonly BatchUpdate[],
  judge: InTransactionRuleJudge | undefined
): Effect.Effect<void, BusinessRuleViolationError | DatabaseError> =>
  judge === undefined
    ? Effect.void
    : Effect.tryPromise({
        try: () =>
          judgeInTransaction(
            on,
            tableName,
            updates.map((update) => update.id),
            judge
          ),
        catch: (error) =>
          error instanceof BusinessRuleViolationError
            ? error
            : new DatabaseError(`Failed to read the records of a batch in ${tableName}`, error),
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
export const batchUpdateRecords =
  (db: PortableDb, dialect: Dialect) =>
  (
    session: Readonly<Session>,
    tableName: string,
    updates: readonly BatchUpdate[],
    written: {
      readonly accounts?: readonly AccountReference[] | undefined
      readonly judge?: InTransactionRuleJudge | undefined
      /** Columns written only while empty: a batch finding one filled is refused whole. */
      readonly writeOnce?: readonly string[] | undefined
    } = {}
  ): Effect.Effect<
    readonly Record<string, unknown>[],
    DatabaseError | ValidationError | BusinessRuleViolationError
  > => {
    const { accounts, judge, writeOnce = [] } = written
    const wrap = wrapDatabaseErrorWithValidation(`Failed to batch update records in ${tableName}`)
    return Effect.gen(function* () {
      const merged = mergeUpdates(updates)
      const committed =
        merged.length === 0
          ? []
          : yield* withOutboxTransaction(
              { client: db, dialect },
              (changes: readonly CommittedRowChange[]) => changes
            )(
              (tx) =>
                Effect.andThen(confirmBatchAccounts(tx, dialect, accounts), () =>
                  Effect.andThen(judgedBatch({ tx, dialect }, tableName, updates, judge), () =>
                    writeBatch({ tx, dialect }, tableName, session, { merged, writeOnce })
                  )
                ),
              (error) => (error instanceof BusinessRuleViolationError ? error : wrap(error))
            )
      // Logged and reported once the transaction has committed — a rolled-back
      // batch changed nothing.
      yield* logCommittedRowChanges(db, session, committed)
      yield* reportCommittedRows(committed)
      return committed.flatMap((change) => (change.row === undefined ? [] : [{ ...change.row }]))
    })
  }
