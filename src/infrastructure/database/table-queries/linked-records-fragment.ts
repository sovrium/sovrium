/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { likePatternOf } from '@/domain/kernel/sql/like-pattern'
import { LIKE_ESCAPE_CHARACTER } from '@/domain/kernel/sql/sql-formatting'
import { junctionKeyColumns } from '../sql/sql-junction-tables'
import { tableIdentifier, validateColumnName } from './statement/validation'
import type { LinkedRecordsValue } from '@/domain/models/app/tables/linked-records-filter-service'

/** The link table of `value`, aliased `link`, and its two key columns. */
const linkTableOf = (value: LinkedRecordsValue) => {
  const [sourceColumn, relatedColumn] = junctionKeyColumns(value.sourceTable, value.relatedTable)
  const link = sql.identifier('link')
  return {
    from: sql`${sql.identifier(value.linkTable)} AS ${link}`,
    source: sql`${link}.${sql.identifier(sourceColumn)}`,
    relatedEnd: sql`${link}.${sql.identifier(relatedColumn)}`,
  }
}

const OUTER_ID = sql.identifier('id')

/** An id condition: the rows linked to one of the ids, or to none of them. */
const linkedIdsFragment = (
  value: Extract<LinkedRecordsValue, { readonly ids: readonly string[] }>
): Readonly<SQL> => {
  const negated = value.operator === 'notEquals'
  if (value.ids.length === 0) return negated ? sql`(1 = 1)` : sql`(1 = 0)`
  const { from, source, relatedEnd } = linkTableOf(value)
  const ids = sql.join(
    value.ids.map((id) => sql`${id}`),
    sql`, `
  )
  const linked = sql`SELECT ${source} FROM ${from} WHERE CAST(${relatedEnd} AS TEXT) IN (${ids})`
  return negated ? sql`(${OUTER_ID} NOT IN (${linked}))` : sql`(${OUTER_ID} IN (${linked}))`
}

/** A text condition: the rows linked to a live record whose display field matches. */
const linkedTextFragment = (
  value: Extract<LinkedRecordsValue, { readonly text: string }>
): Readonly<SQL> => {
  if (!value.readable) return sql`(1 = 0)`
  validateColumnName(value.displayField)
  const { from, source, relatedEnd } = linkTableOf(value)
  const target = sql.identifier('target')
  const display = sql`${target}.${sql.identifier(value.displayField)}`
  // sql-literal: keyword -- the escape character is a module constant
  const escape = sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)
  const match = sql`lower(${display}) LIKE lower(${likePatternOf(value.operator, value.text)}) ESCAPE ${escape}`
  const live = sql`${target}.${sql.identifier('deleted_at')} IS NULL`
  const joined = sql`${tableIdentifier(value.relatedTable)} AS ${target} ON ${target}.${sql.identifier('id')} = ${relatedEnd}`
  return sql`(${OUTER_ID} IN (SELECT ${source} FROM ${from} JOIN ${joined} WHERE ${match} AND ${live}))`
}

/**
 * The WHERE condition of a many-to-many condition, read through the link table
 * (`linked-records-filter-service.ts`): the row's `id` among the link table's
 * source ids whose related end matches — `NOT IN` for `notEquals`, so a row
 * with no link at all is kept. The link table's key columns are never null
 * (they form its primary key), which is what makes `NOT IN` safe here.
 *
 * Ids are compared as text, so one comparison serves an integer key and a text
 * key on both engines. A text condition joins the related table and matches
 * its display field without regard to case, live rows only; a reader that
 * field does not admit matches nothing. Every identifier is validated or
 * derived and rendered through `sql.identifier`; every value is bound (S3).
 *
 * The outer `id` is left unqualified, as the link-name condition leaves its
 * column: it sits outside the subquery, so it can only name the listed table.
 */
export const linkedRecordsFragment = (value: LinkedRecordsValue): Readonly<SQL> =>
  'ids' in value ? linkedIdsFragment(value) : linkedTextFragment(value)
