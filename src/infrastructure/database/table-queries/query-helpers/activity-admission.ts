/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { inArray, sql, type Column, type SQL } from 'drizzle-orm'
import { isInValueSet } from '@/infrastructure/database/sql/value-set-membership'
import { tableIdentifier } from '@/infrastructure/database/table-queries/statement/validation'
import { buildUserFilterConditions } from './aggregation-helpers'
import type {
  ActivityTableAdmission,
  ActivityLogFilters,
} from '@/application/ports/repositories/analytics/activity-log-repository'
import type { QueryFilterNode } from '@/application/ports/repositories/tables/table-repository'

/**
 * The SQL that admits activity entries to a reader, one table at a time.
 *
 * The activity feed shows a non-admin an entry only when a single-record read
 * of its record would (`checkRecordReadGate`): the table's read grant, then
 * its row-level read rule judged on the record as it stands, a record that no
 * longer exists (or sits in the trash) refused. The grant is decided once per
 * table before the query; the rule is judged HERE, by the database, in the
 * statement that selects the page — so the page and its total cost one
 * statement each instead of a record read per record.
 *
 * The rule is rendered by the records list's own builder
 * (`buildUserFilterConditions`: bound values, `sql.identifier` names), so an
 * empty (NULL) value satisfies no `eq`, `neq` or `in`, exactly as in the
 * records list and in the in-memory evaluator the single-record read uses. One
 * rewrite remains: a column the table does not have reads as absent, and an
 * absent value satisfies no operator either.
 */

/** A node that matches no row, rendered `(1 = 0)`. */
const MATCH_NONE: QueryFilterNode = { or: [] }

/**
 * `rule` as the database must judge it for a table holding `columns`, so it
 * admits exactly the rows the in-memory evaluator admits (see above).
 */
export const adaptRuleToColumns = (
  rule: QueryFilterNode,
  columns: ReadonlySet<string>
): QueryFilterNode => {
  if ('and' in rule) return { and: rule.and.map((child) => adaptRuleToColumns(child, columns)) }
  if ('or' in rule) return { or: rule.or.map((child) => adaptRuleToColumns(child, columns)) }
  return columns.has(rule.field) ? rule : MATCH_NONE
}

/**
 * The condition a live row of a table holding `columns` meets to be judged at
 * all, and to pass `rule` when one is given: not in the trash.
 */
export const liveRowCondition = (
  columns: ReadonlySet<string>,
  rule: QueryFilterNode | undefined
): Readonly<SQL> => {
  const ruleConditions =
    rule === undefined
      ? []
      : buildUserFilterConditions({ and: [adaptRuleToColumns(rule, columns)] })
  const live = columns.has('deleted_at') ? [sql`${sql.identifier('deleted_at')} IS NULL`] : []
  const conditions = [...ruleConditions, ...live]
  return conditions.length === 0 ? sql`(1 = 1)` : sql`(${sql.join(conditions, sql` AND `)})`
}

/**
 * The ids (as text, as the activity log stores them) of the live rows of
 * `tableName` that pass `rule`.
 */
export const admittedRecordIds = (
  tableName: string,
  columns: ReadonlySet<string>,
  rule: QueryFilterNode
): Readonly<SQL> =>
  sql`SELECT CAST(${sql.identifier('id')} AS TEXT) FROM ${tableIdentifier(tableName)} WHERE ${liveRowCondition(columns, rule)}`

/** The activity-log columns the admission reads. */
export interface ActivityColumns {
  readonly tableName: Column
  readonly recordId: Column
}

/**
 * The condition an activity entry meets to be admitted under `admission`.
 * `columnsOf` answers, for each `rule` table, the columns it holds.
 */
export const admissionCondition = (
  admission: readonly ActivityTableAdmission[],
  activity: ActivityColumns,
  columnsOf: (tableName: string) => ReadonlySet<string>
): Readonly<SQL> => {
  const whole = admission.filter((scope) => scope.rows === 'all').map((scope) => scope.tableName)
  const wholeTables = whole.length === 0 ? [] : [inArray(activity.tableName, whole)]
  const narrowed = admission.flatMap((scope) => {
    if (scope.rows === 'all') return []
    const rows =
      scope.rows === 'rule'
        ? sql`${activity.recordId} IN (${admittedRecordIds(scope.tableName, columnsOf(scope.tableName), scope.rule)})`
        : isInValueSet(activity.recordId, scope.recordIds)
    return [sql`(${activity.tableName} = ${scope.tableName} AND ${rows})`]
  })
  const branches = [...wholeTables, ...narrowed]
  return branches.length === 0 ? sql`(1 = 0)` : sql`(${sql.join(branches, sql` OR `)})`
}

/** The tables whose rule the database judges — the ones whose columns it must know. */
export const ruleTables = (admission: 'everything' | readonly ActivityTableAdmission[]) =>
  admission === 'everything'
    ? []
    : admission.filter((scope) => scope.rows === 'rule').map((scope) => scope.tableName)

/** Narrow `admission` to the table a `tableName` filter names, when one is given. */
export const admissionForFilters = (
  admission: 'everything' | readonly ActivityTableAdmission[],
  filters: ActivityLogFilters
): 'everything' | readonly ActivityTableAdmission[] =>
  admission === 'everything' || filters.tableName === undefined
    ? admission
    : admission.filter((scope) => scope.tableName === filters.tableName)
