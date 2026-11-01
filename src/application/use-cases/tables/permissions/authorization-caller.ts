/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who is asking, as every authorization verdict reads it.
 *
 * A request reaches the records of a table carrying a role and the groups the
 * caller belongs to. The verdicts (`authorize-record-verbs`) need more: every
 * `user_access` role the caller holds, the assignments a row-level rule reads
 * (`$currentUser.assignments.<table>`), her email, and whether she is signed in
 * at all. This program gathers them once, through the repository ports, so
 * every door judges the same caller.
 */

import { Effect } from 'effect'
import { isAdminEquivalent } from '@/domain/models/app'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { buildEffectiveRoles, getUserAccessRoles } from '../user-groups'
import {
  loadCurrentUserContext,
  rowRuleScopeOf,
  toSessionProjection,
} from './row-level-enforcement'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App, Table } from '@/domain/models/app'
import type { TableGateScope } from '@/domain/models/app/auth/permission-evaluator-service'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'

/**
 * The caller as the request resolved her: the account role and the names of
 * the groups she belongs to (un-prefixed).
 */
export interface RequestCaller {
  readonly userRole: string
  readonly userGroups: readonly string[]
}

/** The caller every verdict judges. */
export interface AuthorizationCaller {
  readonly current: CurrentUserContext
  /** Account role + a `group:<name>` entry per membership + every `user_access` role. */
  readonly effectiveRoles: readonly string[]
  /**
   * The app the table-level grant is judged against: its tables are the set a
   * table's `inherit` resolves against, and its role ladder names the top role
   * the admin override admits beside the built-in `admin`.
   */
  readonly allTables: TableGateScope
  /**
   * The caller is a visitor who is not signed in — decided from the session's
   * identity (the guest sentinel id), never from the name of her role.
   */
  readonly signedOut: boolean
  /**
   * Who the field-level rules judge, for a door that wants the field sets of
   * an `Allowed` verdict: the app, the account role and the group names. Absent,
   * the verdict carries no field set.
   */
  readonly fields?: FieldCaller
}

/** The caller as the field-level read and write rules judge her. */
export interface FieldCaller {
  readonly app: App
  readonly role: string
  readonly groups: readonly string[]
}

type Requirements = DataSourceRepository | AuthRepository

const mergeRoles = (primary: readonly string[], extras: readonly string[]): readonly string[] => [
  ...new Set<string>([...primary, ...extras]),
]

/**
 * Resolve the caller for one table of the app.
 *
 * A visitor with no session reaches here under the placeholder `guest`
 * identity. That placeholder is never read as a person: her context is the
 * signed-out one, in which no `$currentUser` value resolves, so a rule naming
 * the signed-in person matches no row for her.
 *
 * The `user_access` roles are looked up failing closed (`getUserAccessRoles`).
 */
export const resolveAuthorizationCaller = (
  session: Pick<UserSession, 'userId'>,
  caller: RequestCaller,
  table: Pick<Table, 'rowLevelPermissions'>,
  app: Pick<App, 'auth' | 'tables'>
): Effect.Effect<AuthorizationCaller, never, Requirements> =>
  Effect.gen(function* () {
    const { userRole, userGroups } = caller
    const projection = toSessionProjection(session, {
      role: userRole,
      // A literal `admin` is always unrestricted; the app's resolved top custom
      // role is admin-equivalent too, and a mid-level custom role stays scoped.
      isUnrestricted: isAdminEquivalent(userRole, app),
    })
    // A rule reading through a relationship is followed in the app's tables.
    const scope = rowRuleScopeOf(table, app.tables)
    const current = yield* loadCurrentUserContext(projection, table.rowLevelPermissions, scope)
    const userAccessRoles = yield* getUserAccessRoles(session.userId)
    const effectiveRoles = mergeRoles(buildEffectiveRoles(userRole, userGroups), userAccessRoles)
    return { current, effectiveRoles, allTables: app, signedOut: isGuestSession(session.userId) }
  }).pipe(Effect.withSpan('tables.resolve-authorization-caller'))

/**
 * {@link resolveAuthorizationCaller} for a table that declares row-level
 * rules, else `undefined`: a table without them is judged on the caller's
 * account role and groups alone.
 */
export const resolveRowRuleCaller = (
  session: Pick<UserSession, 'userId'>,
  caller: RequestCaller,
  table: Pick<Table, 'rowLevelPermissions'> | undefined,
  app: Pick<App, 'auth' | 'tables'>
): Effect.Effect<AuthorizationCaller | undefined, never, Requirements> =>
  (table?.rowLevelPermissions
    ? resolveAuthorizationCaller(session, caller, table, app)
    : Effect.undefined
  ).pipe(Effect.withSpan('tables.resolve-row-rule-caller'))
