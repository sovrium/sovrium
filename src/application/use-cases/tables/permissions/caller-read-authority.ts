/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a NAMED CALLER may read in a table — the records API's read gates,
 * answered for a user id rather than for an HTTP request.
 *
 * The read twin of `authorizeCallerWrites`, and it shares its caller: the same
 * {@link loadCallerIdentity} gathers the role, groups, `user_access` roles and
 * assignments, and refuses an account that no longer exists or has been banned.
 * From that identity the scope carries the three rules a records-API read meets:
 * the table's read grant (no grant, no scope at all), the row-level `read` rule
 * (as a filter clause the list pushes into SQL, and as a predicate a single row
 * is judged by), and the field read audiences (the columns a row keeps).
 *
 * It DECLARES its requirements (standing rule E1): the run that calls it
 * already holds the automation runtime's services.
 */

import { Effect } from 'effect'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import {
  isPredicateGroup,
  projectPredicateToFilter,
  projectWhenToFilter,
} from '@/domain/models/app/tables/row-level-evaluator-service'
import {
  rowLevelRuleFor,
  rowPassesRule,
} from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { loadCallerIdentity } from './caller-write-authority'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type {
  QueryFilterNode,
  TableRepository,
} from '@/application/ports/repositories/tables/table-repository'
import type { App, Table } from '@/domain/models/app'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'

type Row = Readonly<Record<string, unknown>>

/** What the caller may read in one table. */
export interface CallerReadScope {
  /**
   * The row-level read rule as a filter clause to AND onto a list query:
   * `undefined` when no rule narrows this caller, `'nothing'` when the rule
   * admits no row at all.
   */
  readonly clause: QueryFilterNode | 'nothing' | undefined
  /** Whether one stored row passes the row-level read rule. */
  readonly admits: (row: Row) => boolean
  /** Whether the caller may read one column. */
  readonly readsColumn: (column: string) => boolean
  /** The row with every column the caller may not read removed. */
  readonly project: (row: Row) => Row
}

/** The read rule projected for SQL, or `'nothing'` when it cannot admit a row. */
const readClauseOf = (
  table: Table,
  ctx: CurrentUserContext
): QueryFilterNode | 'nothing' | undefined => {
  const rule = rowLevelRuleFor(table.rowLevelPermissions, 'read')
  if (rule === undefined || ctx.isUnrestricted) return undefined
  const projected = isPredicateGroup(rule)
    ? projectWhenToFilter(rule, ctx)
    : projectPredicateToFilter(rule, ctx)
  if (projected === undefined) return 'nothing'
  const emptyIn =
    'operator' in projected &&
    projected.operator === 'in' &&
    Array.isArray(projected.value) &&
    projected.value.length === 0
  return emptyIn ? 'nothing' : (projected as QueryFilterNode)
}

/**
 * The scope the caller the session names reads `tableName` under, or
 * `undefined` when they may not read it at all — a table that does not exist,
 * an account with no standing, and a missing read grant all answer `undefined`,
 * which the caller maps to the records API's `Resource not found`.
 */
export const callerReadScope = (
  app: App,
  session: Readonly<UserSession>,
  tableName: string
): Effect.Effect<
  CallerReadScope | undefined,
  never,
  AuthRepository | DataSourceRepository | TableRepository
> =>
  Effect.gen(function* () {
    const table = app.tables?.find((t) => t.name === tableName)
    if (table === undefined) return undefined
    const identity = yield* loadCallerIdentity(app, session.userId, table)
    if (identity === undefined) return undefined
    if (!hasReadPermissionForRoles(table, identity.effectiveRoles, app)) return undefined
    const caller = { role: identity.role, groups: identity.groups }
    const readable = (column: string): boolean =>
      isFieldReadableByCaller(app, tableName, caller, column)
    return {
      clause: readClauseOf(table, identity.ctx),
      // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
      admits: (row: Row) =>
        rowPassesRule(
          table.rowLevelPermissions,
          'read',
          readStoredValues(table, row),
          identity.ctx
        ),
      readsColumn: readable,
      project: (row: Row) =>
        Object.fromEntries(Object.entries(row).filter(([column]) => readable(column))),
    }
  }).pipe(Effect.withSpan('tables.caller-read-scope', { attributes: { 'table.name': tableName } }))
