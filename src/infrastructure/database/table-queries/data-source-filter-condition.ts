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
import {
  isNotLoggedCreatorValue,
  NOT_LOGGED_CREATOR_OPERATOR,
} from '@/domain/models/app/tables/read-state-service'
import { LIST_MEMBER_OPERATOR } from '@/domain/models/app/tables/user-list-field-service'
import { emptyValueCondition, nonEmptyValueCondition } from './filter-operators'
import { notLoggedCreatorFragment } from './logged-creator-fragment'
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
const bindLikePattern = (
  value: unknown,
  operator: 'contains' | 'startsWith' = 'contains'
): Readonly<SQL> =>
  sql`${likePatternOf(operator, typeof value === 'string' ? value : String(value))}`

/** The predicate no row matches: what a filter answers when it can match nothing. */
const NO_ROW = sql`1 = 0`

/**
 * A text operator as a case-folded `LIKE`: a bare `LIKE` is case-SENSITIVE on
 * PostgreSQL and case-INSENSITIVE on SQLite, so both sides are folded and the
 * same filter binds the same rows on both engines.
 */
const likeCondition = (
  field: SqlIdentifier,
  value: unknown,
  operator: 'contains' | 'startsWith'
): Readonly<SQL> =>
  // sql-literal: keyword -- the escape character is a module constant
  sql`LOWER(${field}) LIKE LOWER(${bindLikePattern(value, operator)}) ESCAPE ${sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)}`

/**
 * `between [low, high]`: both ends kept, each a bound value, so a date
 * compares as a date on PostgreSQL. Anything but a two-item list matches no row.
 */
const betweenCondition = (field: SqlIdentifier, value: unknown): Readonly<SQL> => {
  if (!Array.isArray(value) || value.length !== 2) return NO_ROW
  const low: unknown = value[0]
  const high: unknown = value[1]
  if (low === null || low === undefined || high === null || high === undefined) return NO_ROW
  return sql`${field} >= ${bindValue(low)} AND ${field} <= ${bindValue(high)}`
}

export function buildFilterCondition(filter: DataFilter): Readonly<SQL> {
  const field = sql.identifier(sanitizeTableName(filter.field))
  return serverOperatorCondition(filter, field) ?? valueCondition(field, filter)
}

/**
 * The operators the engine itself writes into a filter, never an author:
 * `undefined` for an author's operator.
 */
function serverOperatorCondition(
  filter: DataFilter,
  field: SqlIdentifier
): Readonly<SQL> | undefined {
  const { operator, value } = filter
  // `contains` on a list of people, rewritten by the read gate into membership.
  if ((operator as string) === LIST_MEMBER_OPERATOR) return listMemberFragment(field, value)
  // A row its reader did not create, as the activity log records it: a
  // conversation's New marker on a table that declares no `created-by` field.
  if ((operator as string) === NOT_LOGGED_CREATOR_OPERATOR && isNotLoggedCreatorValue(value)) {
    return notLoggedCreatorFragment(sanitizeTableName(filter.field), value)
  }
  return undefined
}

/** An author's operator over `field`, every value a bound parameter. */
function valueCondition(field: SqlIdentifier, filter: DataFilter): Readonly<SQL> {
  const { operator, value } = filter
  // Matches the records-API decision in `table-queries/filter-operators.ts`.
  if (operator === 'contains' || operator === 'startsWith') {
    return likeCondition(field, value, operator)
  }
  if (operator === 'between') return betweenCondition(field, value)
  if (operator === 'in') return buildInClause(field, value)

  // `isEmpty` / `isNotEmpty` take no value: the records API's own rule (NULL,
  // empty text, an empty list), so a server-drawn list and a grid over the same
  // data source never disagree about emptiness.
  if (operator === 'isEmpty') return emptyValueCondition(field)
  if (operator === 'isNotEmpty') return nonEmptyValueCondition(field)

  // The comparison operator reaches SQL only through this closed literal map,
  // never as caller text. An operator with no case here is refused — it
  // matches no row — never compared as equality.
  const sqlOp = DATA_SOURCE_OPERATOR_MAP[operator]
  if (sqlOp) {
    // sql-literal: keyword -- `sqlOp` comes from the closed DATA_SOURCE_OPERATOR_MAP
    return sql`${field} ${sql.raw(sqlOp)} ${bindValue(value)}`
  }
  return NO_ROW
}

/**
 * Build an `IN (...)` clause from a literal or an array.
 *
 * - Empty array  → `1 = 0` (always-false predicate, returns zero rows)
 * - No value     → `1 = 0` too: `undefined`, `null` or the empty text — what a
 *   `$record.<field>` token naming an empty or unreadable list resolves to — is
 *   an empty list, never a comparison with `''` (which a PostgreSQL integer
 *   column refuses outright)
 * - Non-array    → `field = value` (single-value short-hand)
 * - Array        → `field IN ($1, $2, ...)` — one bound parameter per element
 *
 * Used by `$currentUser.assignments.<table>` resolution where the value is
 * the flattened record-id list from the multi-tenant `user_access` rows.
 */
function buildInClause(field: SqlIdentifier, value: unknown): Readonly<SQL> {
  if (Array.isArray(value)) {
    if (value.length === 0) return NO_ROW
    return sql`${field} IN (${sql.join(
      value.map((element) => bindValue(element)),
      sql.raw(', ')
    )})`
  }
  if (value === undefined || value === null || value === '') return NO_ROW
  return sql`${field} = ${bindValue(value)}`
}
