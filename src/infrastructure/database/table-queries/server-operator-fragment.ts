/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import {
  isLinkedRecordsValue,
  LINKED_RECORDS_OPERATOR,
} from '@/domain/models/app/tables/linked-records-filter-service'
import {
  isNotLoggedCreatorValue,
  NOT_LOGGED_CREATOR_OPERATOR,
} from '@/domain/models/app/tables/read-state-service'
import {
  isRelatedTextValue,
  RELATED_TEXT_OPERATOR,
} from '@/domain/models/app/tables/related-text-filter-service'
import { LIST_MEMBER_OPERATOR } from '@/domain/models/app/tables/user-list-field-service'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { escapeSqlString } from '../sql/sql-utils'
import { linkedRecordsFragment } from './linked-records-fragment'
import { notLoggedCreatorFragment } from './logged-creator-fragment'
import { relatedTextFragment } from './related-text-fragment'

/**
 * The operators only the server writes into a filter, after rewriting a
 * caller's condition: a text match against a linked record's display field,
 * and membership in a list of people. A caller cannot send either — the records
 * API vocabulary refuses them — so each is compiled here, apart from the
 * operators a caller names. The unread count writes a third: a row not created
 * by its reader, as the activity log records it.
 */

/**
 * "The list column holds `value`": membership in a `text[]` on PostgreSQL, in a
 * JSON array on SQLite. The value is bound; an empty or absent list matches
 * nothing.
 */
export const listMemberFragment = (
  column: Readonly<ReturnType<typeof sql.identifier>>,
  value: unknown
): Readonly<SQL> => {
  const member = String(value)
  return isSqliteRuntime()
    ? sql`(json_valid(${column}) AND EXISTS (SELECT 1 FROM json_each(${column}) WHERE json_each.value = ${member}))`
    : sql`(${member} = ANY(${column}))`
}

/**
 * {@link listMemberFragment} spelled for a view definition, where nothing can
 * be bound: the same membership test, with `quotedMember` an already escaped
 * SQL string literal and `column` an already quoted column expression. Both
 * spellings sit here so the rule is stated once, side by side.
 */
export const listMemberDdlCondition = (column: string, quotedMember: string): string =>
  isSqliteRuntime()
    ? `(json_valid(${column}) AND EXISTS (SELECT 1 FROM json_each(${column}) WHERE json_each.value = ${quotedMember}))`
    : `(${quotedMember} = ANY(${column}))`

/** The fragment of a server-written condition on `field`, or `undefined` for any other operator. */
export const serverOperatorFragment = (
  field: string,
  operator: string,
  value: unknown
): Readonly<SQL> | undefined => {
  if (operator === RELATED_TEXT_OPERATOR && isRelatedTextValue(value)) {
    return relatedTextFragment(field, value)
  }
  if (operator === LIST_MEMBER_OPERATOR) return listMemberFragment(sql.identifier(field), value)
  if (operator === LINKED_RECORDS_OPERATOR && isLinkedRecordsValue(value)) {
    return linkedRecordsFragment(value)
  }
  if (operator === NOT_LOGGED_CREATOR_OPERATOR && isNotLoggedCreatorValue(value)) {
    return notLoggedCreatorFragment(field, value)
  }
  return undefined
}

/**
 * The condition of a server-written condition on `field` in a view definition,
 * where nothing can be bound, or `undefined` for any other operator: today,
 * `contains` on a list of people, rewritten into membership by the filter walker.
 */
export const serverOperatorDdlCondition = (
  field: string,
  operator: string,
  value: unknown
): string | undefined => {
  if (operator !== LIST_MEMBER_OPERATOR) return undefined
  // sql-literal: ddl -- a view definition is stored, so its configured value cannot be bound
  return listMemberDdlCondition(field, `'${escapeSqlString(String(value))}'`)
}
