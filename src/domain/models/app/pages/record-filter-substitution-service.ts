/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from '@/domain/kernel/config-parsing/map-strings-deep'
import { parseJsonArrayCell } from '@/domain/kernel/sql/sqlite-json-cell'
import { isRecordFieldRef, substituteRecordVars } from './substitute-record-vars'
import type { DataFilter } from './components/data-source'

/** The filter that matches no row, on the field `filter` names. */
const matchingNothing = (filter: DataFilter): DataFilter => ({
  ...filter,
  operator: 'in',
  value: [],
})

/** A list value substituted: an `in` drops the items resolving empty, any other operator matches nothing on one. */
const substituteList = (
  filter: DataFilter,
  list: readonly unknown[],
  substitute: (text: string) => string,
  resolvesEmpty: (item: unknown) => boolean
): DataFilter => {
  if (filter.operator !== 'in' && list.some(resolvesEmpty)) return matchingNothing(filter)
  const kept = list.filter((item) => !resolvesEmpty(item))
  return { ...filter, value: mapStringsDeep(kept, substitute) as DataFilter['value'] }
}

/**
 * One `dataSource.filter` condition made concrete from a record: the record a
 * collection page shows, or the row a nested list is drawn for.
 *
 * An `in` naming one field wholly (`$record.exercises`) takes that field's
 * list as its list (a many-to-many field's linked ids, a multi-select's
 * choices) rather than the list printed as text; an empty one matches nothing.
 * A list keeps its items, each string substituted. Every other value is the
 * token as text.
 *
 * A value written with tokens that resolve to nothing (a relationship or a
 * text the record leaves empty) matches no row, whatever the operator: it
 * becomes `in []`, never a comparison with the empty text, which a row can
 * hold and a PostgreSQL number column refuses. An `in` list drops such an
 * item. A value the author wrote as the empty text stays a comparison with it.
 */
export const substituteRecordInFilter = (
  filter: DataFilter,
  record: Readonly<Record<string, unknown>>
): DataFilter => {
  const { value } = filter
  if (value === undefined) return filter
  const substitute = (text: string): string => substituteRecordVars(text, record)
  const resolvesEmpty = (item: unknown): boolean =>
    typeof item === 'string' && item !== '' && substitute(item) === ''
  if (Array.isArray(value)) return substituteList(filter, value, substitute, resolvesEmpty)
  if (typeof value !== 'string') {
    return { ...filter, value: mapStringsDeep(value, substitute) as DataFilter['value'] }
  }
  if (filter.operator === 'in' && isRecordFieldRef(value)) {
    const stored = record[value.slice('$record.'.length)]
    const list = Array.isArray(stored) ? stored : parseJsonArrayCell(stored)
    if (list !== undefined) return { ...filter, value: list.map(String) }
  }
  return resolvesEmpty(value) ? matchingNothing(filter) : { ...filter, value: substitute(value) }
}
