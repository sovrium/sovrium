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
import {
  generateJunctionTableName,
  toSingular,
} from '@/infrastructure/database/sql/sql-junction-tables'
import { wrapDatabaseError } from '../statement/error-handling'
import { validateTableName } from '../statement/validation'

/**
 * [internal ref]: writing and reading a native `many-to-many` relationship field.
 *
 * A many-to-many field creates no column on the base table — the link lives in
 * an auto-generated junction table `<sourceTable>_<relatedTable>` with INTEGER
 * columns `<singular(sourceTable)>_id` and `<singular(relatedTable)>_id`
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
 * "config-bounded" is exactly what the 2026-07-25 pool-exhaustion incident
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
  /**
   * Whether the related table declares a reciprocal many-to-many field back to
   * the source table. When true, the mirror junction `<relatedTable>_<sourceTable>`
   * exists and must also receive the row so the reciprocal side sees the link.
   */
  readonly hasReciprocal: boolean
}

export interface LinkManyToManyInput {
  readonly sourceTable: string
  readonly sourceId: string | number
  readonly links: readonly ManyToManyLink[]
}

/** A single INSERT into the junction that pairs `aTable` (aId) with `bTable` (bId). */
const junctionInsert = (
  aTable: string,
  bTable: string,
  aId: string | number,
  bId: string | number
): Readonly<SQL> => {
  validateTableName(aTable)
  validateTableName(bTable)
  const junction = generateJunctionTableName(aTable, bTable)
  const aCol = `${toSingular(aTable)}_id`
  const bCol = `${toSingular(bTable)}_id`
  // Composite primary key (aCol, bCol) makes ON CONFLICT DO NOTHING idempotent
  // on both dialects — re-linking an existing pair is a no-op, not an error.
  return sql`INSERT INTO ${sql.identifier(junction)} (${sql.identifier(aCol)}, ${sql.identifier(bCol)}) VALUES (${coerceId(aId)}, ${coerceId(bId)}) ON CONFLICT DO NOTHING`
}

/** Every junction INSERT for a source record (own junction + reciprocal mirror). */
const buildLinkStatements = (input: LinkManyToManyInput): readonly Readonly<SQL>[] =>
  input.links.flatMap((link) =>
    link.relatedIds.flatMap((relatedId) => {
      const own = junctionInsert(input.sourceTable, link.relatedTable, input.sourceId, relatedId)
      return link.hasReciprocal
        ? [own, junctionInsert(link.relatedTable, input.sourceTable, relatedId, input.sourceId)]
        : [own]
    })
  )

/**
 * Write the junction rows for a record's many-to-many fields. Runs in one
 * transaction, sequentially (SQLite drives a single connection per tx). A no-op
 * when there are no links.
 */
export const linkManyToMany = (input: LinkManyToManyInput): Effect.Effect<void, DatabaseError> => {
  const statements = buildLinkStatements(input)
  if (statements.length === 0) return Effect.void
  return Effect.tryPromise({
    // Chain the INSERTs sequentially (SQLite drives a single connection per tx)
    // as a promise fold — no imperative statements.
    try: () =>
      db.transaction((tx) =>
        statements.reduce<Promise<unknown>>(
          (prev, statement) => prev.then(() => executeRaw(tx, statement)),
          Promise.resolve(undefined)
        )
      ),
    catch: wrapDatabaseError(`Failed to link many-to-many records for ${input.sourceTable}`),
  })
}

/** A many-to-many field to resolve for a set of source records. */
export interface ManyToManyReadField {
  readonly fieldName: string
  readonly relatedTable: string
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
  validateTableName(sourceTable)
  validateTableName(field.relatedTable)
  const junction = generateJunctionTableName(sourceTable, field.relatedTable)
  const srcCol = `${toSingular(sourceTable)}_id`
  const relCol = `${toSingular(field.relatedTable)}_id`
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
  return Effect.all(
    input.fields.map((field) =>
      Effect.tryPromise({
        try: async () => ({
          field,
          byRecord: foldFieldRows(await readFieldRows(input.sourceTable, input.sourceIds, field)),
        }),
        catch: wrapDatabaseError(`Failed to read many-to-many records for ${input.sourceTable}`),
      })
    ),
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
