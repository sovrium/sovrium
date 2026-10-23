/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { pageConditionsInBag } from '@/domain/models/app/pages/shared-filter-condition-service'
import { matchesConditionOperators } from '@/domain/models/app/tables/condition-match-service'
import type { TableRecord } from '../../runtime/types'
import type { ApiCondition } from '@/domain/models/app/pages/shared-filter-condition-service'

/**
 * The conditions a page control published on a grid's channel, applied to the
 * rows the grid holds.
 *
 * A control publishing `{ field, operator }` sends its condition to the read as
 * the records API's `filter`. The records API applies it; a system endpoint
 * does not read `filter` at all, so on a grid over one the request alone would
 * narrow nothing. When such a grid holds EVERY row of its source, the rows on
 * screen are the whole answer and the condition can be applied to them here,
 * as the search term already is. A grid that holds one page of a larger
 * answer is left alone: narrowing a page would present a slice of a slice as
 * the whole match.
 *
 * Each condition is ANDed with the others, as the request would have ANDed
 * them, and `isEmpty` / `isNotEmpty` read their published value as the flag.
 */

/** The value a page operator compares with, in the shape `matchesConditionOperators` reads. */
const operatorsOf = (condition: ApiCondition): Readonly<Record<string, unknown>> => {
  const { operator, value } = condition
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return { [operator]: true }
  if (operator === 'between' && Array.isArray(value)) return { gte: value[0], lte: value[1] }
  return { [operator]: value }
}

/** Whether one row satisfies one published condition. */
const rowMatches = (row: TableRecord, condition: ApiCondition): boolean => {
  // Rows arrive flat: the fetch layer lifts a record's fields to the top level.
  const cell = row[condition.field]
  if (condition.operator === 'startsWith') {
    return String(cell ?? '')
      .toLowerCase()
      .startsWith(String(condition.value).toLowerCase())
  }
  return matchesConditionOperators(operatorsOf(condition), cell)
}

/**
 * The rows that satisfy every condition in `bag`, or `rows` itself when the
 * bag holds none (the same reference, so nothing downstream re-renders).
 */
export function narrowByPublishedConditions(
  rows: readonly TableRecord[],
  bag: Readonly<Record<string, string>>
): readonly TableRecord[] {
  const conditions = pageConditionsInBag(bag)
  if (conditions.length === 0) return rows
  return rows.filter((row) => conditions.every((condition) => rowMatches(row, condition)))
}
