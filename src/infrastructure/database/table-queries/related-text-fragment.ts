/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { likePatternOf } from '@/domain/kernel/sql/like-pattern'
import { LIKE_ESCAPE_CHARACTER } from '@/domain/kernel/sql/sql-formatting'
import {
  isRelatedTextValue,
  RELATED_TEXT_OPERATOR,
  type RelatedTextValue,
} from '@/domain/models/app/tables/related-text-filter-service'
import { tableIdentifier, validateColumnName } from './statement/validation'

/**
 * The WHERE condition of a text condition on a relationship column, read
 * against the linked record's display field (`related-text-filter-service.ts`):
 * the rows whose stored id is among the related rows whose display field
 * matches. Matched without regard to case, as every text filter is.
 *
 * An `IN (SELECT …)` over the related table rather than a correlated EXISTS, so
 * the outer column needs no table qualifier. Every identifier is validated and
 * rendered through `sql.identifier`; the text is ONE bound parameter (S3).
 * `equals` keeps the stored-id comparison and matches an exact name besides; a
 * reader the display field does not admit matches nothing by name. Only a live
 * related row matches by name: one in the trash is not a record a reader sees.
 * Under the related table's row rule (`value.ruled`), only a row `admitted`
 * — that rule, projected for the reader and compiled by the caller — matches
 * by name; a ruled condition compiled without it matches nothing by name.
 *
 * Reached only through `RELATED_TEXT_OPERATOR`, which only the server's own
 * rewrite produces: the records API refuses it from a caller as an unknown
 * operator, so no request can name the table this condition reads.
 */
export const relatedTextFragment = (
  column: string,
  value: RelatedTextValue,
  admitted?: Readonly<SQL>
): Readonly<SQL> => {
  validateColumnName(column)
  validateColumnName(value.displayField)
  const outer = sql.identifier(column)
  // As text, so a name compared with an integer id is a mismatch, not a PostgreSQL error.
  const sameId = sql`CAST(${outer} AS TEXT) = ${value.text}`
  const byName = value.readable && (value.ruled !== true || admitted !== undefined)
  if (!byName) return value.operator === 'equals' ? sameId : sql`(1 = 0)`
  const display = sql.identifier(value.displayField)
  const match =
    value.operator === 'equals'
      ? sql`lower(${display}) = lower(${value.text})`
      : // sql-literal: keyword -- the escape character is a module constant
        sql`lower(${display}) LIKE lower(${likePatternOf(value.operator, value.text)}) ESCAPE ${sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)}`
  const live = sql`${sql.identifier('deleted_at')} IS NULL`
  const where = sql.join([match, live, ...(admitted === undefined ? [] : [admitted])], sql` AND `)
  const related = sql`${outer} IN (SELECT ${sql.identifier('id')} FROM ${tableIdentifier(value.table)} WHERE ${where})`
  return value.operator === 'equals' ? sql`(${sameId} OR ${related})` : related
}

/**
 * A link-name leaf carrying its related table's rule, compiled with that rule
 * rendered by `render` — the filter-tree renderer, handed in so this module
 * stays a leaf of it. `undefined` for any other leaf.
 */
export const ruledRelatedTextFragment = (
  leaf: { readonly field: string; readonly operator: string; readonly value: unknown },
  render: (rule: unknown) => Readonly<SQL>
): Readonly<SQL> | undefined =>
  leaf.operator === RELATED_TEXT_OPERATOR &&
  isRelatedTextValue(leaf.value) &&
  leaf.value.rule !== undefined
    ? relatedTextFragment(leaf.field, leaf.value, render(leaf.value.rule))
    : undefined
