/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The relation a list reads when some of its lookups must be evaluated as
 * EMPTY for the rows whose linked record the reader may not read.
 *
 * A lookup is a column of the table's view, computed for every reader alike.
 * A filter, a sort or an aggregate naming it would therefore steer on a value
 * the reader never receives. Instead of the view, such a query reads a derived
 * relation of the same name whose masked lookup columns are:
 *
 *   - through a key column (many-to-one, one-to-one):
 *     `CASE WHEN EXISTS (SELECT 1 FROM <related> WHERE id = <key> AND <rule>)
 *     THEN <lookup> END` — the view's value when the linked row is readable,
 *     `NULL` otherwise;
 *   - through a many-to-many link: the lookup recomputed over the junction,
 *     restricted to the linked rows that pass the rule (and the lookup's own
 *     filters), `NULL` when none does;
 *   - through a related table's link back (a reverse lookup): the lookup
 *     recomputed over the related rows whose back-link column holds the row's
 *     id, restricted the same way;
 *   - a lookup of a lookup, through a key column at every hop: the view's
 *     value when one nested `EXISTS` finds, hop after hop, a live record under
 *     each key that passes its table's rule, `NULL` otherwise;
 *   - a lookup of a lookup that copies a list (many-to-many or reverse at the
 *     end of its key columns): the list recomputed through one correlated
 *     subquery per hop — a live record under each key that passes its table's
 *     rule — over the listed rows that pass the list table's rule, so it keeps
 *     the names the reader may read and none other.
 *
 * Every recomputed shape read LIVE related rows only, as the view does.
 *
 * Every other column is passed through by name, so the WHERE, ORDER BY and
 * aggregate clauses built for the view apply unchanged. Rule values are bound
 * parameters (the shared filter renderer); names go through `sql.identifier`.
 */

import { sql, type SQL } from 'drizzle-orm'
import { Effect } from 'effect'
import { DatabaseError } from '@/infrastructure/database'
import { stringAggExpression } from '@/infrastructure/database/sql/dialect-ddl'
import { listTableColumns } from '@/infrastructure/database/sql/dialect-introspection'
import {
  generateJunctionTableName,
  junctionKeyColumns,
} from '@/infrastructure/database/sql/sql-generators'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { validateColumnName, tableIdentifier, databaseTableName } from '../statement/validation'
import { buildUserFilterConditions, type FilterNode } from './aggregation-helpers'
import type { RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'

/** A lookup to mask — the structural twin of the port's `LookupReadMask`. */
export interface LookupReadMaskSpec {
  readonly lookup: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly readable: FilterNode | undefined
  readonly link:
    | { readonly kind: 'column'; readonly column: string }
    | { readonly kind: 'junction'; readonly filters?: FilterNode }
    | { readonly kind: 'reverse'; readonly column: string; readonly filters?: FilterNode }
    | {
        readonly kind: 'chain'
        readonly hops: readonly {
          readonly column: string
          readonly relatedTable: string
          readonly readable: FilterNode | undefined
        }[]
        readonly list?: ListSpec
      }
}

/** The list a chain copies at its end — the structural twin of the port's `LookupReadList`. */
interface ListSpec {
  readonly kind: 'junction' | 'reverse'
  readonly sourceTable: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly column?: string
  readonly readable: FilterNode | undefined
  readonly filters?: FilterNode
}

type ChainHop = Extract<LookupReadMaskSpec['link'], { readonly kind: 'chain' }>['hops'][number]

const SOURCE = 'sovrium_masked_source'

/** `<a> AND <b> …` over the rendered nodes, or `TRUE`-equivalent when none. */
const conditionOf = (nodes: readonly FilterNode[]): Readonly<SQL> => {
  const parts = buildUserFilterConditions({ and: nodes })
  return parts.length === 0 ? sql`(1 = 1)` : sql.join([...parts], sql` AND `)
}

/**
 * `EXISTS` a live record of hop `index` under `key` that the reader may read,
 * and — through its own key column — every hop after it. Each hop's record is
 * the only relation its subquery reads, so its rule's unqualified names
 * resolve to it, as the `column` shape's `EXISTS` relies on.
 */
const hopCondition = (
  hops: readonly ChainHop[],
  index: number,
  key: Readonly<SQL>
): Readonly<SQL> => {
  const hop = hops[index] as ChainHop
  const alias = sql.identifier(`sovrium_mask_hop${index + 1}`)
  const next = hops[index + 1]
  if (next !== undefined) validateColumnName(next.column)
  const nextCondition =
    next === undefined
      ? []
      : [hopCondition(hops, index + 1, sql`${alias}.${sql.identifier(next.column)}`)]
  const conditions = [
    sql`${alias}.${sql.identifier('id')} = ${key}`,
    sql`${alias}.${sql.identifier('deleted_at')} IS NULL`,
    ...(hop.readable === undefined ? [] : [conditionOf([hop.readable])]),
    ...nextCondition,
  ]
  return sql`EXISTS (SELECT 1 FROM ${tableIdentifier(hop.relatedTable)} AS ${alias} WHERE ${sql.join(conditions, sql` AND `)})`
}

/** The masked expression of one lookup, aliased to its own name. */
const maskedColumn = (tableName: string, mask: LookupReadMaskSpec): Readonly<SQL> => {
  validateColumnName(mask.lookup)
  validateColumnName(mask.relatedField)
  const own = sql`${sql.identifier(SOURCE)}.${sql.identifier(mask.lookup)}`
  const alias = sql.identifier(mask.lookup)
  if (mask.link.kind === 'chain') {
    const [first] = mask.link.hops
    // A chain with no hop has nothing to judge by: empty on every row.
    if (first === undefined) return sql`CASE WHEN 1 = 0 THEN ${own} END AS ${alias}`
    validateColumnName(first.column)
    const key = sql`${sql.identifier(SOURCE)}.${sql.identifier(first.column)}`
    if (mask.link.list !== undefined) {
      const value = hopValue(mask.link.hops, 0, key, mask.link.list)
      return sql`CASE WHEN ${key} IS NOT NULL THEN ${value} END AS ${alias}`
    }
    return sql`CASE WHEN ${hopCondition(mask.link.hops, 0, key)} THEN ${own} END AS ${alias}`
  }
  // Keeps the column's type on both dialects, where a bare NULL would not.
  if (mask.readable === undefined) return sql`CASE WHEN 1 = 0 THEN ${own} END AS ${alias}`
  const related = tableIdentifier(mask.relatedTable)
  if (mask.link.kind === 'column') {
    validateColumnName(mask.link.column)
    const key = sql`${sql.identifier(SOURCE)}.${sql.identifier(mask.link.column)}`
    return sql`CASE WHEN EXISTS (SELECT 1 FROM ${related} WHERE ${sql.identifier('id')} = ${key} AND ${conditionOf([mask.readable])}) THEN ${own} END AS ${alias}`
  }
  return recomputedColumn(tableName, mask, mask.readable, mask.link)
}

/**
 * The list a chain copies, recomputed from hop `index` on: a live record of
 * that hop under `key` that passes its table's rule, then — through its own
 * key column — every hop after it, and at the last one the list itself over
 * the rows the reader may read ({@link listAggregate}). `NULL` wherever a hop
 * is missing, trashed or hidden. Each hop's record is the only relation its
 * subquery's WHERE reads, so its rule's unqualified names resolve to it.
 */
const hopValue = (
  hops: readonly ChainHop[],
  index: number,
  key: Readonly<SQL>,
  list: ListSpec
): Readonly<SQL> => {
  const hop = hops[index] as ChainHop
  const alias = sql.identifier(`sovrium_mask_hop${index + 1}`)
  const next = hops[index + 1]
  if (next !== undefined) validateColumnName(next.column)
  const value =
    next === undefined
      ? listAggregate(list, sql`${alias}.${sql.identifier('id')}`)
      : hopValue(hops, index + 1, sql`${alias}.${sql.identifier(next.column)}`, list)
  const conditions = [
    sql`${alias}.${sql.identifier('id')} = ${key}`,
    sql`${alias}.${sql.identifier('deleted_at')} IS NULL`,
    ...(hop.readable === undefined ? [] : [conditionOf([hop.readable])]),
  ]
  return sql`(SELECT ${value} FROM ${tableIdentifier(hop.relatedTable)} AS ${alias} WHERE ${sql.join(conditions, sql` AND `)})`
}

/**
 * A many-to-many or reverse lookup, recomputed over the linked rows that pass
 * `readable` (and the lookup's own filters): through the junction, or through
 * the related rows whose back-link column holds the row's id.
 */
const recomputedColumn = (
  tableName: string,
  mask: LookupReadMaskSpec,
  readable: FilterNode,
  link: Exclude<LookupReadMaskSpec['link'], { readonly kind: 'column' | 'chain' }>
): Readonly<SQL> => {
  const list: ListSpec = {
    kind: link.kind,
    sourceTable: tableName,
    relatedTable: mask.relatedTable,
    relatedField: mask.relatedField,
    readable,
    ...(link.kind === 'reverse' ? { column: link.column } : {}),
    ...(link.filters === undefined ? {} : { filters: link.filters }),
  }
  const sourceId = sql`${sql.identifier(SOURCE)}.${sql.identifier('id')}`
  return sql`${listAggregate(list, sourceId)} AS ${sql.identifier(mask.lookup)}`
}

/**
 * The PostgreSQL types the driver hands the server as JavaScript numbers —
 * the only values the display orders by magnitude rather than by their text.
 */
const PG_NUMBER_TYPES = ['smallint', 'integer', 'real', 'double precision'] as const

/**
 * The `ORDER BY` of a copied list, matching the display's comparator
 * (`many-to-many-lookup-narrowing.ts`): numbers by magnitude, everything else
 * by its text compared code unit by code unit — capitals before lowercase,
 * accented letters after both. SQLite's default `BINARY` collation already
 * compares that way (UTF-8 bytes order as code points). PostgreSQL's ordering
 * follows the database's collation, so text is ordered under `"C"` (bytes),
 * and only a column the driver reads as a number keeps its numeric order —
 * judged per value with `pg_typeof`, so one expression serves every type.
 */
const displayOrder = (value: string): string => {
  if (isSqliteRuntime()) return value
  const numberTypes = PG_NUMBER_TYPES.map((type) => `'${type}'::regtype`).join(', ')
  return `CASE WHEN pg_typeof(${value}) IN (${numberTypes}) THEN (${value})::text::double precision END, (${value})::text COLLATE "C"`
}

/** A listed value that is neither missing nor empty text. */
const nonEmpty = (value: string): string =>
  isSqliteRuntime()
    ? `${value} IS NOT NULL AND CAST(${value} AS TEXT) <> ''`
    : `${value} IS NOT NULL AND (${value})::text <> ''`

/**
 * The value of a copied list over the rows of `list.sourceTable` keyed by
 * `sourceId`: its related field joined, as the lookup's view does, over the
 * live linked rows that pass the list table's rule (`(1 = 1)` where it
 * carries none) and the lookup's own filters; `NULL` when none does.
 */
const listAggregate = (list: ListSpec, sourceId: Readonly<SQL>): Readonly<SQL> => {
  validateColumnName(list.relatedField)
  const related = tableIdentifier(list.relatedTable)
  const scope = [
    ...(list.readable === undefined ? [] : [list.readable]),
    ...(list.filters === undefined ? [] : [list.filters]),
  ]
  const value = `"sovrium_mask_related"."${list.relatedField}"`
  const aggregated = sql.raw(stringAggExpression(value, ', ', displayOrder(value)))
  // A trashed linked row contributes nothing, as in the lookup's own view
  // expression (`lookup-expressions.ts`); neither does an empty item, which the
  // display never shows.
  const live = sql`"sovrium_mask_related"."deleted_at" IS NULL AND ${sql.raw(nonEmpty(value))}`
  if (list.kind === 'reverse') {
    const column = list.column ?? ''
    validateColumnName(column)
    // The related rows are the only relation in scope, so the rule's
    // unqualified names resolve to them, as the `column` shape's EXISTS relies
    // on. Measured on PostgreSQL over 20 000 rows, judging it through the
    // `id IN` self-subquery below instead cost ~1.4x without JIT and ~4-10x
    // once the plan crossed the JIT threshold.
    return sql`(SELECT ${aggregated} FROM ${related} AS "sovrium_mask_related" WHERE "sovrium_mask_related".${sql.identifier(column)} = ${sourceId} AND ${live} AND ${conditionOf(scope)})`
  }
  // Joined to the junction, an unqualified name could be ambiguous, so the
  // rule is judged in a self-subquery. (Moving the junction into a nested
  // subquery to judge it inline measured no faster.)
  const junction = sql.identifier(generateJunctionTableName(list.sourceTable, list.relatedTable))
  const [sourceColumn, relatedColumn] = junctionKeyColumns(list.sourceTable, list.relatedTable)
  const sourceKey = sql.identifier(sourceColumn)
  const relatedKey = sql.identifier(relatedColumn)
  const readableRelated = sql`${live} AND "sovrium_mask_related"."id" IN (SELECT ${sql.identifier('id')} FROM ${related} WHERE ${conditionOf(scope)})`
  return sql`(SELECT ${aggregated} FROM ${junction} AS "sovrium_mask_junction" INNER JOIN ${related} AS "sovrium_mask_related" ON "sovrium_mask_related"."id" = "sovrium_mask_junction".${relatedKey} WHERE "sovrium_mask_junction".${sourceKey} = ${sourceId} AND ${readableRelated})`
}

/**
 * The FROM target of a query over `tableName`: the relation itself when no
 * mask applies, else the derived relation described above, under the same name.
 */
export const maskedRelation = (
  tx: Readonly<RawSqlRunner>,
  tableName: string,
  masks: readonly LookupReadMaskSpec[] | undefined,
  alias?: string
): Effect.Effect<Readonly<SQL>, DatabaseError> => {
  // With an `alias`, the relation is named by it in both shapes; without, the
  // derived relation takes the table's own name and the bare table stands.
  const bare =
    alias === undefined
      ? sql`${tableIdentifier(tableName)}`
      : sql`${tableIdentifier(tableName)} AS ${sql.identifier(alias)}`
  if (masks === undefined || masks.length === 0) return Effect.succeed(bare)
  return Effect.tryPromise({
    try: async () => {
      const columns = await listTableColumns(tx, databaseTableName(tableName))
      const names = new Set(columns.map((column) => column.name))
      const applied = masks.filter((mask) => names.has(mask.lookup))
      if (applied.length === 0) return bare
      const maskedNames = new Set(applied.map((mask) => mask.lookup))
      const passed = columns
        .filter((column) => !maskedNames.has(column.name))
        .map((column) => sql`${sql.identifier(SOURCE)}.${sql.identifier(column.name)}`)
      const list = sql.join(
        [...passed, ...applied.map((mask) => maskedColumn(tableName, mask))],
        sql`, `
      )
      return sql`(SELECT ${list} FROM ${tableIdentifier(tableName)} AS ${sql.identifier(SOURCE)}) AS ${sql.identifier(alias ?? databaseTableName(tableName))}`
    },
    catch: (error) => new DatabaseError(`Failed to mask the lookups of ${tableName}`, error),
  })
}
