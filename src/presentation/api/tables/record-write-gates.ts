/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  hasCreatePermissionForRoles,
  hasReadPermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { createAllowed } from '@/domain/models/app/tables/row-level-write-decision-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { checkFieldConditionReadOnly } from './record-update-guards'
import { checkTableUpdatePermissionWithRole } from './record-update-permissions'
import { forbiddenCreateResponse, forbiddenCreateScopeResponse } from './response-helpers'
import {
  passesTableRoleGate,
  type RowLevelGuardContext,
  enforceFormMutationGate,
  resolveGuardForTable,
} from './row-level-guard'
import type { App, Table } from '@/domain/models/app'
import type {
  TableGateScope,
  hasCreatePermission,
  hasReadPermission,
} from '@/domain/models/app/auth/permission-evaluator-service'
import type { getTableContext } from '@/presentation/api/runtime/context-helpers'
import type { Context } from 'hono'

/**
 * Check create permission for table and user role
 * Returns error response if permission denied, undefined otherwise
 */
function checkCreatePermission(
  table: Parameters<typeof hasCreatePermission>[0],
  effectiveRoles: readonly string[],
  c: Context,
  allTables?: TableGateScope
) {
  if (hasCreatePermissionForRoles(table, effectiveRoles, allTables)) return undefined
  // Enumeration protection: users without read access get 404 (prevents resource discovery)
  const readTable = table as Parameters<typeof hasReadPermission>[0]
  if (!hasReadPermissionForRoles(readTable, effectiveRoles, allTables)) {
    return notFound(c)
  }
  return forbiddenCreateResponse(c)
}

interface CreateGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly userRole: string
  /** Group names the user belongs to (un-prefixed) — group-aware RBAC. */
  readonly userGroups: readonly string[]
  readonly guard: RowLevelGuardContext | undefined
}

/**
 * Z-3 create role gate. Returns 404/403/undefined depending on permissions.
 */
export function checkCreateGate(input: CreateGateInput): Response | undefined {
  const { c, app, table, userRole, userGroups, guard } = input
  if (!guard) {
    const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
    return checkCreatePermission(table, effectiveRoles, c, app)
  }
  if (passesTableRoleGate(table, 'create', guard)) return undefined
  // Lack of read access collapses to 404 (enumeration safety).
  if (!passesTableRoleGate(table, 'read', guard)) {
    return notFound(c)
  }
  return forbiddenCreateResponse(c)
}

/**
 * Z-3 create.when predicate check. The user's proposed row must satisfy
 * the predicate; out-of-scope creates return 403.
 */
export function checkCreatePredicate(
  c: Context,
  table: Table | undefined,
  guard: RowLevelGuardContext | undefined,
  fields: Readonly<Record<string, unknown>>
): Response | undefined {
  if (!guard || !table?.rowLevelPermissions) return undefined
  if (createAllowed(table, fields, guard.current)) {
    return undefined
  }
  return forbiddenCreateScopeResponse(c)
}

interface UpdateGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly userRole: string
  /** Group names the user belongs to (un-prefixed) — group-aware RBAC. */
  readonly userGroups: readonly string[]
  readonly recordId: string
  readonly guard: RowLevelGuardContext | undefined
  /** The change the update proposes — `write.when` is checked on the row as written too. */
  readonly change: Readonly<Record<string, unknown>>
}

async function checkUpdateGateAndPredicate(input: UpdateGateInput): Promise<Response | undefined> {
  const { c, app, table, session, tableName, userRole, userGroups, recordId, guard, change } = input

  if (!guard) {
    // Group-aware, mirroring `checkCreateGate` above. The guarded branch below
    // has always evaluated `guard.effectiveRoles`; this unguarded branch used a
    // bare `userRole`, so a `group:<name>` entry in `permissions.update` could
    // never match and an `update: ['group:finance']` grant was inert for every
    // member of `finance` — while the same grant worked for `create`. The
    // group overlay exists only in the effective-role set.
    const permissionCheck = checkTableUpdatePermissionWithRole(
      app,
      tableName,
      buildEffectiveRoles(userRole, userGroups),
      c
    )
    return permissionCheck.allowed ? undefined : permissionCheck.response
  }

  // The single-record gate the delete door asks: the read grant, the row
  // (missing answers 404), the write grant, then `read.when` AND `write.when`
  // on the row as it stands and `write.when` on the row as written. A row the
  // read rule hides from the caller is refused as a missing one, even where
  // the write rule admits it. Every denial is the missing row's 404 (S1).
  return enforceFormMutationGate({
    c,
    table,
    session,
    tableName,
    recordId,
    guard,
    op: 'write',
    change,
  })
}

/**
 * Run all pre-mutation update gates in order: the Z-3 role/predicate gate
 * then the field-`condition` read-only lock. Returns the first failing
 * response, or `undefined` when the update may proceed.
 */
export async function checkUpdateGates(input: UpdateGateInput): Promise<Response | undefined> {
  const { c, table, session, tableName, recordId } = input
  const updateGateError = await checkUpdateGateAndPredicate(input)
  if (updateGateError) return updateGateError
  // Reject updates to records locked by a field `condition` (readOnly: true).
  return checkFieldConditionReadOnly({ c, table, session, tableName, recordId })
}

/**
 * Handle form-based UPDATE (POST) with redirect
 *
 * Used for update forms rendered as <form method="POST">.
 * Performs the record update and redirects to the _redirect path from form body
 * (or back to the Referer URL if no redirect is specified).
 *
 * This synchronous-navigation approach ensures the database write completes
 * before the browser proceeds, eliminating race conditions in E2E tests and
 * providing reliable behavior for users on slow connections.
 */
/**
 * Z-3 form-update auth gate: row-level scoping when declared, canonical
 * role-only check otherwise. Extracted so handleFormUpdateRecord stays
 * under the 50-line/function limit.
 */
export async function resolveFormUpdateAuth(input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  /** Group names the user belongs to (un-prefixed) — group-aware RBAC. */
  readonly userGroups: readonly string[]
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly recordId: string
  /** The posted change — `write.when` is checked on the row as written too. */
  readonly change: Readonly<Record<string, unknown>>
}): Promise<Response | undefined> {
  const { c, app, tableName, userRole, userGroups, session, recordId, change } = input
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, { userRole, userGroups }, table, app)

  if (guard) {
    return enforceFormMutationGate({
      c,
      table,
      session,
      tableName,
      recordId,
      guard,
      op: 'write',
      change,
    })
  }
  const permissionCheck = checkTableUpdatePermissionWithRole(
    app,
    tableName,
    buildEffectiveRoles(userRole, userGroups),
    c
  )
  return permissionCheck.allowed ? undefined : permissionCheck.response
}
