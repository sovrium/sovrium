/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { likePatternOf } from '@/domain/kernel/sql/like-pattern'
import { LIKE_ESCAPE_CHARACTER, LIKE_ESCAPE_CLAUSE } from '@/domain/kernel/sql/sql-formatting'
import { formatLikePattern } from '../sql/sql-utils'

/**
 * `notContains`, the negation of `contains`, in its two compiled forms: the
 * SQL text of a view or lookup filter, and the bound fragment of a runtime
 * record query.
 *
 * Same case rule as `contains` (both sides folded), and the rows with no value
 * are KEPT: an empty value contains nothing — the rule a branch condition
 * applies. Without its own arm the operator fell through to the equality
 * fallback and selected the rows EQUAL to the text, the opposite of what was
 * asked, in every record step that filters (list, update, delete, upsert,
 * aggregate, batch).
 */

/** The SQL text of a `notContains` condition on `field`; `undefined` for any other operator. */
export const notContainsSqlCondition = (
  field: string,
  operator: string,
  value: unknown
): string | undefined =>
  operator === 'notContains'
    ? `(${field} IS NULL OR LOWER(${field}) NOT LIKE LOWER(${formatLikePattern(value, 'contains')}) ${LIKE_ESCAPE_CLAUSE})`
    : undefined

/** The bound fragment of a `notContains` condition on `column`; `undefined` for any other operator. */
export const notContainsFragment = (
  column: Readonly<ReturnType<typeof sql.identifier>>,
  operator: string,
  value: unknown
): Readonly<SQL> | undefined => {
  if (operator !== 'notContains') return undefined
  const pattern = likePatternOf('contains', typeof value === 'string' ? value : String(value))
  // sql-literal: keyword -- the escape character is a module constant
  return sql`(${column} IS NULL OR lower(${column}) NOT LIKE lower(${pattern}) ESCAPE ${sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)})`
}
