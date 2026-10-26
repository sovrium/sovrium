/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { Effect } from 'effect'
import { db, type DatabaseError } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { junctionKeyColumns } from '@/infrastructure/database/sql/sql-junction-tables'
import { wrapDatabaseError } from '../statement/error-handling'

/**
 * Writing and reading a native `many-to-many` relationship field.
 *
 * A many-to-many field creates no column on the base table — the link lives in
 * the field's own junction table (`<sourceTable>_<relatedTable>`, or
 * `<sourceTable>_<relatedTable>_<field>` beside another many-to-many to the
 * same table; the caller names it, derived from the config) with columns
 * `<singular(sourceTable)>_id` and `<singular(relatedTable)>_id`
 * (see `sql-junction-tables.ts`). The record-create pipeline therefore has to
 * split a many-to-many field out of the base INSERT and write the junction
 * rows separately, and the read pipeline has to resolve the field's value back
 * from the junction (there is no base column to `SELECT *`).
 */

/**
 * Width of the per-field fan-out in {@link readManyToMany}.
 *
 * Unlike the batch helpers (whose fan-outs ride a transaction's single reserved
 * connection), this one runs on the SHARED connection pool — `readFieldRows`
 * executes against the `db` facade, not a `tx`. And it sits on the record-LIST
 * hot path (`application/use-cases/tables/record-link-enrichment.ts` →
 * `enrichRecordsWithManyToMany`), so several requests fan out at once.
 *
 * The width is config-bounded (one query per many-to-many FIELD on the table;
 * `sourceIds` is already collapsed into a single `IN (...)` per field), but
 * "config-bounded" is exactly what a production pool-exhaustion incident
 * proved is not a safety argument on the shared pool: there, the widening
 * dimension was also just configuration. A table with several many-to-many
 * fields, listed concurrently, would otherwise take an arbitrary share of
 * `DEFAULT_DATABASE_POOL_MAX` (10).
 *
 * Two matches the DB-bound precedent in
 * `infrastructure/database/repositories/tables/tables-overview-repository-live.ts`
 * and `infrastructure/database/views/view-generators.ts`, leaving eight of the
 * ten default pool slots for the rest of the process.
 */
const READ_FIELD_FANOUT_CONCURRENCY = 2

/** Junction column values are declared `INTEGER`; coerce numeric-looking ids. */
const coerceId = (value: string | number): string | number =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value

/** A single many-to-many field's write intent for one source record. */
export interface ManyToManyLink {
  readonly relatedTable: string
  readonly relatedIds: readonly (string | number)[]
  /** The field's own link table. */
  readonly linkTable: string
  /**
   * The link table of the related table's field that is this field's
   * reciprocal, when there is one: each link is mirrored there so the
   * reciprocal side sees it. Absent, nothing is mirrored.
   */
  readonly mirrorLinkTable?: string | undefined
}

export interface LinkManyToManyInput {
  readonly sourceTable: string
  readonly sourceId: string | number
  readonly links: readonly ManyToManyLink[]
}

/** One end of a junction row: the link table, its two tables (in its key order) and their ids. */
interface JunctionRow {
  readonly junction: string
  readonly aTable: string
  readonly bTable: string
  readonly aId: string | number
  readonly bId: string | number
}

/** A single INSERT into the junction that pairs `aTable` (aId) with `bTable` (bId). */
const junctionInsert = ({ junction, aTable, bTable, aId, bId }: JunctionRow): Readonly<SQL> => {
  const [aCol, bCol] = junctionKeyColumns(aTable, bTable)
  // Composite primary key (aCol, bCol) makes ON CONFLICT DO NOTHING idempotent
  // on both dialects — re-linking an existing pair is a no-op, not an error.
  return sql`INSERT INTO ${sql.identifier(junction)} (${sql.identifier(aCol)}, ${sql.identifier(bCol)}) VALUES (${coerceId(aId)}, ${coerceId(bId)}) ON CONFLICT DO NOTHING`
}

/** Each junction row a source record's links name: its own, then the reciprocal mirror. */
const junctionRowsOf = (input: LinkManyToManyInput): readonly JunctionRow[] =>
  input.links.flatMap((link) =>
    link.relatedIds.flatMap((relatedId): readonly JunctionRow[] => {
      const own: JunctionRow = {
        junction: link.linkTable,
        aTable: input.sourceTable,
        bTable: link.relatedTable,
        aId: input.sourceId,
        bId: relatedId,
      }
      return link.mirrorLinkTable === undefined
        ? [own]
        : [
            own,
            {
              junction: link.mirrorLinkTable,
              aTable: link.relatedTable,
              bTable: input.sourceTable,
              aId: relatedId,
              bId: input.sourceId,
            },
          ]
    })
  )

/** Every junction INSERT for a source record (own junction + reciprocal mirror). */
const buildLinkStatements = (input: LinkManyToManyInput): readonly Readonly<SQL>[] =>
  junctionRowsOf(input).map(junctionInsert)

/**
 * Write a record's junction rows on an OPEN transaction, one statement after
 * the other — for a caller that must commit or roll back the links together
 * with the record itself (a single or batch create, an update).
 */
export const writeManyToManyLinksInTransaction = (
  tx: Parameters<typeof executeRaw>[0],
  input: LinkManyToManyInput
): Promise<unknown> =>
  buildLinkStatements(input).reduce<Promise<unknown>>(
    (prev, statement) => prev.then(() => executeRaw(tx, statement)),
    Promise.resolve(undefined)
  )

/** A single DELETE of the junction row that pairs `aTable` (aId) with `bTable` (bId). */
const junctionDelete = ({ junction, aTable, bTable, aId, bId }: JunctionRow): Readonly<SQL> => {
  const [aCol, bCol] = junctionKeyColumns(aTable, bTable)
  return sql`DELETE FROM ${sql.identifier(junction)} WHERE ${sql.identifier(aCol)} = ${coerceId(aId)} AND ${sql.identifier(bCol)} = ${coerceId(bId)}`
}

/** Every junction DELETE for a source record (own junction + reciprocal mirror). */
const buildUnlinkStatements = (input: LinkManyToManyInput): readonly Readonly<SQL>[] =>
  junctionRowsOf(input).map(junctionDelete)

/**
 * Remove a record's named junction rows on an OPEN transaction — the inverse of
 * {@link writeManyToManyLinksInTransaction}, for a write that must commit or
 * roll back the removal together with the record itself.
 */
export const removeManyToManyLinksInTransaction = (
  tx: Parameters<typeof executeRaw>[0],
  input: LinkManyToManyInput
): Promise<unknown> =>
  buildUnlinkStatements(input).reduce<Promise<unknown>>(
    (prev, statement) => prev.then(() => executeRaw(tx, statement)),
    Promise.resolve(undefined)
  )

/** A many-to-many field to resolve for a set of source records. */
export interface ManyToManyReadField {
  readonly fieldName: string
  readonly relatedTable: string
  /** The field's own link table. */
  readonly linkTable: string
}

export interface ReadManyToManyInput {
  readonly sourceTable: string
  readonly sourceIds: readonly (string | number)[]
  readonly fields: readonly ManyToManyReadField[]
}

/** Resolved links: `recordId -> fieldName -> relatedIds`. */
export type ManyToManyResult = Record<string, Record<string, readonly (string | number)[]>>

/** SELECT the junction rows for one field across all source records. */
const readFieldRows = (
  sourceTable: string,
  sourceIds: readonly (string | number)[],
  field: ManyToManyReadField
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  const junction = field.linkTable
  const [srcCol, relCol] = junctionKeyColumns(sourceTable, field.relatedTable)
  const idList = sql.join(
    sourceIds.map((id) => sql`${coerceId(id)}`),
    sql.raw(', ')
  )
  return executeRaw(
    db,
    sql`SELECT ${sql.identifier(srcCol)} AS src, ${sql.identifier(relCol)} AS rel FROM ${sql.identifier(junction)} WHERE ${sql.identifier(srcCol)} IN (${idList})`
  )
}

/** Fold junction rows for one field into the `recordId -> relatedIds` shape. */
const foldFieldRows = (
  rows: ReadonlyArray<Record<string, unknown>>
): Readonly<Record<string, readonly (string | number)[]>> =>
  rows.reduce<Record<string, (string | number)[]>>((acc, row) => {
    const src = String(row.src)
    const rel = row.rel as string | number
    return { ...acc, [src]: [...(acc[src] ?? []), rel] }
  }, {})

/**
 * Resolve every many-to-many field's value for the given source records from
 * their junction tables. Returns `recordId -> fieldName -> relatedIds`; a record
 * with no links for a field is simply absent (callers default to `[]`).
 *
 * The per-field fan-out is bounded at {@link READ_FIELD_FANOUT_CONCURRENCY} —
 * these queries run on the SHARED pool, on the record-list hot path. Order is
 * preserved (`Effect.all`, like `Promise.all`), which the fold below relies on
 * only for determinism, not correctness (each field writes a distinct key).
 */
export const readManyToMany = (
  input: ReadManyToManyInput
): Effect.Effect<ManyToManyResult, DatabaseError> => {
  if (input.fields.length === 0 || input.sourceIds.length === 0) return Effect.succeed({})
  return Effect.forEach(
    input.fields,
    (field) =>
      Effect.tryPromise({
        try: async () => ({
          field,
          byRecord: foldFieldRows(await readFieldRows(input.sourceTable, input.sourceIds, field)),
        }),
        catch: wrapDatabaseError(`Failed to read many-to-many records for ${input.sourceTable}`),
      }),
    { concurrency: READ_FIELD_FANOUT_CONCURRENCY }
  ).pipe(
    Effect.map((perField) =>
      perField.reduce<ManyToManyResult>(
        (acc, { field, byRecord }) =>
          Object.entries(byRecord).reduce<ManyToManyResult>((inner, [recordId, ids]) => {
            const existing = inner[recordId] ?? {}
            return { ...inner, [recordId]: { ...existing, [field.fieldName]: ids } }
          }, acc),
        {}
      )
    )
  )
}

/** The rows of a many-to-many relationship's source table to look up by their links. */
export interface ManyToManyHoldersInput {
  readonly table: string
  readonly relatedTable: string
  /** The relationship field's own link table. */
  readonly linkTable: string
  readonly relatedIds: readonly string[]
}

/**
 * The ids of the rows of `table` whose many-to-many relationship to
 * `relatedTable` links at least one of `relatedIds` — membership, answered
 * from the link table. Every id is bound (S3); the related key column is read
 * as text so one comparison serves an integer key and a text key alike, on
 * both engines.
 */
export const readManyToManyHolders = (
  input: ManyToManyHoldersInput
): Effect.Effect<readonly (string | number)[], DatabaseError> => {
  if (input.relatedIds.length === 0) return Effect.succeed([])
  const junction = input.linkTable
  const [srcCol, relCol] = junctionKeyColumns(input.table, input.relatedTable)
  const ids = sql.join(
    input.relatedIds.map((id) => sql`${id}`),
    sql.raw(', ')
  )
  return Effect.tryPromise({
    try: async () => {
      const rows = await executeRaw(
        db,
        sql`SELECT DISTINCT ${sql.identifier(srcCol)} AS src FROM ${sql.identifier(junction)} WHERE CAST(${sql.identifier(relCol)} AS TEXT) IN (${ids})`
      )
      return rows.map((row) => row['src'] as string | number)
    },
    catch: wrapDatabaseError(`Failed to read many-to-many members of ${input.table}`),
  })
}
