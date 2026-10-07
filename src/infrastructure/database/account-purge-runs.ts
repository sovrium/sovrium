/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automation runs an erasure scrubs, inside the erasure's transaction.
 *
 * A run keeps what it read with the engine's authority — a captured record, a
 * step's copy of it, an error quoting it — long after the record is gone. So
 * every run that read one of the erased person's records, a record naming her
 * (a `user` field, a last-editor or deleted-by stamp), or a record the config
 * removes with hers (`onDelete: 'cascade'`) loses every value it captured or
 * produced: its trigger data, each step's input, output, error, logs and
 * recorded reads, its own error, and the message of every request it raised.
 * Its steps, their statuses and its timings stay; `values_erased_at` marks it;
 * its operator-search row goes.
 *
 * Which runs read which records is the index each run writes as it finishes
 * (`system.automation_run_refs`, by id), so this is exact rather than a search
 * of the run history for her id. A ref of `'*'` stands for a whole table.
 *
 * The records are collected BEFORE the erasure deletes or empties anything:
 * afterwards nothing names her any more. Every statement is plain SQL that
 * runs unchanged on both engines; only the table references differ.
 */

import { sql, type SQL } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { nowEpochMsSqlLiteral } from './sql/dialect-ddl'
import { executeRaw, type RawSqlRunner } from './sql/dialect-execute'
import { getExistingColumnNames } from './sql/dialect-introspection'
import { systemTableRef } from './sql/dialect-sql'
import type { DrizzleTransaction } from '@/infrastructure/database'

/** Record ids per table: the records an erasure deletes or empties a field of. */
export type ErasedRecords = ReadonlyMap<string, ReadonlySet<string>>

/** A table that deletes its rows with another table's: the child and its link column. */
export interface CascadingChild {
  readonly table: string
  readonly column: string
}

/** One app table as the run scrub reads it: what names her, and what goes with its rows. */
export interface ErasureReachTable {
  readonly name: string
  /** Columns whose match means "the user AUTHORED this row": the row is deleted. */
  readonly createdByColumns: readonly string[]
  /** Columns naming the user on somebody else's row: updated-by, deleted-by, `user` fields. */
  readonly namingColumns: readonly string[]
  /** The tables whose rows the config deletes with this table's (`onDelete: 'cascade'`). */
  readonly cascadedBy: readonly CascadingChild[]
}

/** Largest id list one statement binds, well inside both engines' parameter limits. */
const CHUNK = 500

/** How many cascades deep removed records are followed. */
const MAX_CASCADE_DEPTH = 8

/**
 * `each` over `items`, one at a time: statements share the erasure's one
 * transaction, which runs them in turn.
 */
const inTurn = <T, R>(items: readonly T[], each: (item: T) => Promise<R>): Promise<readonly R[]> =>
  items.reduce<Promise<readonly R[]>>(
    async (previous, item) => [...(await previous), await each(item)],
    Promise.resolve([])
  )

const chunksOf = <T>(items: readonly T[]): readonly (readonly T[])[] =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, index) =>
    items.slice(index * CHUNK, (index + 1) * CHUNK)
  )

/** `IN (…)` over bound values. */
const inList = (values: readonly string[]): Readonly<SQL> =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )

/** The ids of `table`'s rows whose `column` holds one of `values`, read as text. */
const idsWhere = async (
  tx: Readonly<DrizzleTransaction>,
  table: string,
  column: string,
  values: readonly string[]
): Promise<readonly string[]> => {
  const found = await inTurn(chunksOf(values), (chunk) =>
    executeRaw(
      tx,
      sql`SELECT id FROM ${sql.identifier(table)} WHERE CAST(${sql.identifier(column)} AS TEXT) IN (${inList(chunk)})`
    )
  )
  return found.flat().map((row) => String(row['id']))
}

/** The columns of `table` among `candidates` that exist. */
const existingColumns = async (
  tx: Readonly<DrizzleTransaction>,
  table: string,
  candidates: readonly string[]
): Promise<readonly string[]> => {
  const existing = await getExistingColumnNames(tx as RawSqlRunner, table, candidates)
  return candidates.filter((column) => existing.has(column))
}

/** `ids` added to the record set of `table`. */
const withIds = (records: ErasedRecords, table: string, ids: readonly string[]): ErasedRecords =>
  ids.length === 0
    ? records
    : new Map([...records, [table, new Set([...(records.get(table) ?? []), ...ids])]])

/** The ids of `table`'s rows whose `columns` hold `userId`. */
const idsNaming = async (
  tx: Readonly<DrizzleTransaction>,
  table: string,
  columns: readonly string[],
  userId: string
): Promise<readonly string[]> =>
  (await inTurn(columns, (column) => idsWhere(tx, table, column, [userId]))).flat()

/**
 * The rows the config deletes with `removed` — the children linked to them
 * with `onDelete: 'cascade'` — followed down the cascade.
 */
const withCascades = async (input: {
  readonly tx: Readonly<DrizzleTransaction>
  readonly tables: readonly ErasureReachTable[]
  readonly removed: ErasedRecords
  readonly depth: number
}): Promise<ErasedRecords> => {
  const { tx, tables, removed, depth } = input
  if (depth >= MAX_CASCADE_DEPTH || removed.size === 0) return new Map()
  const links = [...removed].flatMap(([table, ids]) =>
    (tables.find((candidate) => candidate.name === table)?.cascadedBy ?? []).map((child) => ({
      child,
      ids: [...ids],
    }))
  )
  const children = await inTurn(links, async ({ child, ids }) => {
    const columns = await existingColumns(tx, child.table, [child.column])
    const found = columns.length === 0 ? [] : await idsWhere(tx, child.table, child.column, ids)
    return [child.table, found] as const
  })
  const next = children.reduce<ErasedRecords>(
    (acc, [table, ids]) => withIds(acc, table, ids),
    new Map()
  )
  const deeper = await withCascades({ tx, tables, removed: next, depth: depth + 1 })
  return [...deeper].reduce((acc, [table, ids]) => withIds(acc, table, [...ids]), next)
}

/**
 * Every record the erasure of `userId` deletes or empties a field of: her own
 * records, the records naming her, and the records the config deletes with
 * hers. Read before anything is written.
 */
export const collectErasedRecords = async (
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  tables: readonly ErasureReachTable[]
): Promise<ErasedRecords> => {
  const sanitized = tables
    .map((table) => ({ ...table, name: sanitizeTableName(table.name) }))
    .filter((table) => table.name.length > 0)
  const named = await inTurn(sanitized, async (table) => {
    const columns = [...new Set([...table.createdByColumns, ...table.namingColumns])]
    const present = new Set(await existingColumns(tx, table.name, columns))
    const own = await idsNaming(
      tx,
      table.name,
      table.createdByColumns.filter((column) => present.has(column)),
      userId
    )
    const naming = await idsNaming(
      tx,
      table.name,
      table.namingColumns.filter((column) => present.has(column)),
      userId
    )
    return { table: table.name, own, naming }
  })
  const own = named.reduce<ErasedRecords>((acc, row) => withIds(acc, row.table, row.own), new Map())
  const cascaded = await withCascades({ tx, tables, removed: own, depth: 0 })
  const all = named.reduce<ErasedRecords>(
    (acc, row) => withIds(acc, row.table, row.naming),
    [...cascaded].reduce((acc, [table, ids]) => withIds(acc, table, [...ids]), own)
  )
  return all
}

/** The runs whose refs name one of `records`, or a whole table of them. */
const runsReading = async (
  tx: Readonly<DrizzleTransaction>,
  records: ErasedRecords
): Promise<readonly string[]> => {
  const refs = systemTableRef('automation_run_refs')
  const queries = [...records].flatMap(([table, ids]) =>
    chunksOf([...ids, '*']).map((chunk) => ({ table, chunk }))
  )
  const found = await inTurn(queries, ({ table, chunk }) =>
    executeRaw(
      tx,
      sql`SELECT DISTINCT run_id FROM ${refs} WHERE table_name = ${table} AND record_id IN (${inList(chunk)})`
    )
  )
  return [...new Set(found.flat().map((row) => String(row['run_id'])))]
}

/** Run `statement` over `runIds`, a chunk at a time. */
const forRuns = (
  tx: Readonly<DrizzleTransaction>,
  runIds: readonly string[],
  statement: (ids: Readonly<SQL>) => Readonly<SQL>
): Promise<unknown> => inTurn(chunksOf(runIds), (chunk) => executeRaw(tx, statement(inList(chunk))))

/** The four statements that scrub a set of runs, given its `IN (…)` list. */
const SCRUB_STATEMENTS: readonly ((ids: Readonly<SQL>) => Readonly<SQL>)[] = [
  (ids) =>
    // sql-literal: keyword -- the dialect's own clock expression, no caller value
    sql`UPDATE ${systemTableRef('automation_runs')} SET trigger_data = NULL, error = NULL, values_erased_at = COALESCE(values_erased_at, ${sql.raw(nowEpochMsSqlLiteral())}) WHERE id IN (${ids})`,
  (ids) =>
    sql`UPDATE ${systemTableRef('automation_run_steps')} SET input = NULL, output = NULL, error = NULL, logs = NULL, reads = NULL, nested = NULL WHERE run_id IN (${ids})`,
  (ids) =>
    sql`UPDATE ${systemTableRef('automation_approval_requests')} SET message = NULL WHERE run_id IN (${ids})`,
  (ids) =>
    sql`DELETE FROM ${systemTableRef('_admin_search_index')} WHERE type = 'run' AND entity_id IN (${ids})`,
]

/**
 * Empty every value the runs `runIds` captured or produced, keep their steps,
 * statuses and timings, mark them erased and drop them from the operator
 * search. Returns how many runs were scrubbed.
 */
export const scrubRuns = async (
  tx: Readonly<DrizzleTransaction>,
  runIds: readonly string[]
): Promise<number> => {
  if (runIds.length === 0) return 0
  await inTurn(SCRUB_STATEMENTS, (statement) => forRuns(tx, runIds, statement))
  return runIds.length
}

/**
 * Scrub every run that read one of `records` (see the module header). Returns
 * how many runs were scrubbed.
 */
export const scrubRunsReading = async (
  tx: Readonly<DrizzleTransaction>,
  records: ErasedRecords
): Promise<number> => scrubRuns(tx, await runsReading(tx, records))

/** A table field as the reach reads it: its name and type, and a relationship's link. */
interface ReachField {
  readonly name: string
  readonly type: string
  readonly relatedTable?: unknown
  readonly onDelete?: unknown
  readonly relationType?: unknown
}

/** The `user` fields of `tableName`: a person named on somebody else's record. */
export const userFieldNames = (
  tables:
    | ReadonlyArray<{ readonly name: string; readonly fields: ReadonlyArray<ReachField> }>
    | undefined,
  tableName: string
): readonly string[] =>
  (tables?.find((table) => table.name === tableName)?.fields ?? [])
    .filter((field) => field.type === 'user')
    .map((field) => field.name)

/**
 * The tables whose rows the config deletes with `tableName`'s: every
 * relationship to it declaring `onDelete: 'cascade'` from the linking side.
 */
export const cascadingChildren = (
  tables:
    | ReadonlyArray<{ readonly name: string; readonly fields: ReadonlyArray<ReachField> }>
    | undefined,
  tableName: string
): readonly CascadingChild[] =>
  (tables ?? []).flatMap((table) =>
    table.fields
      .filter(
        (field) =>
          field.type === 'relationship' &&
          field.relatedTable === tableName &&
          field.onDelete === 'cascade' &&
          field.relationType !== 'one-to-many' &&
          field.relationType !== 'many-to-many'
      )
      .map((field) => ({ table: table.name, column: field.name }))
  )
