/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { likePatternOf } from '@/domain/kernel/sql/like-pattern'
import { LIKE_ESCAPE_CHARACTER } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { LIST_MEMBER_OPERATOR } from '@/domain/models/app/tables/user-list-field-service'
import { emptyValueCondition, nonEmptyValueCondition } from './filter-operators'
import { listMemberFragment } from './server-operator-fragment'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { SQL } from 'drizzle-orm'

/**
 * One page `dataSource.filters` entry as a SQL condition, every value a bound
 * parameter: the condition builder of the data-source repository
 * (`repositories/tables/data-source-repository-live.ts`), which
 * joins these into its WHERE clause.
 */

/**
 * Return type of `sql.identifier()` — a safely-escaped SQL identifier chunk.
 * Same alias as `table-queries/filter-operators.ts`, and for the same reason:
 * `Name` is not a `SQL`, so a helper that accepts one has to say so.
 */
type SqlIdentifier = Readonly<ReturnType<typeof sql.identifier>>

const DATA_SOURCE_OPERATOR_MAP: Readonly<Record<string, string>> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
}

/**
 * Bind an arbitrary filter value as a DRIVER PARAMETER rather than escaping it
 * into SQL text.
 *
 * Mirrors `formatSqlValue`'s type handling exactly, so switching from escaping
 * to binding changes no result: strings, numbers, booleans and `null` bind as
 * themselves (a bound `null` compares the way the `NULL` literal did — never
 * true), and every other shape binds as its JSON encoding, which is precisely
 * the string `formatSqlValue` would quote.
 */
const bindValue = (value: unknown): Readonly<SQL> => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return sql`${value}`
  }
  return sql`${JSON.stringify(value)}`
}

/**
 * A `contains` LIKE pattern as a BOUND value, through the shared kernel
 * `likePatternOf`: `%`, `_` and the escape character inside the value are
 * escaped, so only the operator's own wildcards stay active. Paired with the
 * `ESCAPE` clause in `buildFilterCondition`, as `filter-operators.ts` does.
 */
const bindLikePattern = (value: unknown): Readonly<SQL> =>
  sql`${likePatternOf('contains', typeof value === 'string' ? value : String(value))}`

export function buildFilterCondition(filter: DataFilter): Readonly<SQL> {
  const field = sql.identifier(sanitizeTableName(filter.field))
  const { operator, value } = filter

  // `contains` on a list of people, rewritten by the read gate into membership.
  if ((operator as string) === LIST_MEMBER_OPERATOR) return listMemberFragment(field, value)

  if (operator === 'contains') {
    // Case-folded on both sides: a bare `LIKE` is case-SENSITIVE on PostgreSQL
    // and case-INSENSITIVE on SQLite, so the same page `dataSource.filters`
    // block would bind different rows depending on the engine. Matches the
    // records-API decision in `table-queries/filter-operators.ts`.
    // sql-literal: keyword -- the escape character is a module constant
    return sql`LOWER(${field}) LIKE LOWER(${bindLikePattern(value)}) ESCAPE ${sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)}`
  }

  if (operator === 'in') {
    return buildInClause(field, value)
  }

  // `isEmpty` / `isNotEmpty` take no value: the records API's own rule
  // (NULL, empty text, an empty list — the `isEmpty`/`isNotEmpty` data-source filter design), so a server-drawn list and
  // a grid over the same data source never disagree about emptiness.
  if (operator === 'isEmpty') return emptyValueCondition(field)
  if (operator === 'isNotEmpty') return nonEmptyValueCondition(field)

  // The comparison operator reaches SQL only through this closed literal map,
  // never as caller text; an unrecognised operator falls through to `=`.
  const sqlOp = DATA_SOURCE_OPERATOR_MAP[operator]
  if (sqlOp) {
    // sql-literal: keyword -- `sqlOp` comes from the closed DATA_SOURCE_OPERATOR_MAP
    return sql`${field} ${sql.raw(sqlOp)} ${bindValue(value)}`
  }

  return sql`${field} = ${bindValue(value)}`
}

/**
 * Build an `IN (...)` clause from a literal or an array.
 *
 * - Empty array  → `1 = 0` (always-false predicate, returns zero rows)
 * - Non-array    → `field = value` (single-value short-hand)
 * - Array        → `field IN ($1, $2, ...)` — one bound parameter per element
 *
 * Used by `$currentUser.assignments.<table>` resolution where the value is
 * the flattened record-id list from the multi-tenant `user_access` rows.
 */
function buildInClause(field: SqlIdentifier, value: unknown): Readonly<SQL> {
  if (Array.isArray(value)) {
    if (value.length === 0) return sql`1 = 0`
    return sql`${field} IN (${sql.join(
      value.map((element) => bindValue(element)),
      sql.raw(', ')
    )})`
  }
  return sql`${field} = ${bindValue(value)}`
}
