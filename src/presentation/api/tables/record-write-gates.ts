/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  hasCreatePermissionForRoles,
  hasReadPermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { checkFieldConditionReadOnly } from './record-update-guards'
import { checkTableUpdatePermissionWithRole } from './record-update-permissions'
import { forbiddenCreateResponse, forbiddenCreateScopeResponse } from './response-helpers'
import {
  passesTableRoleGate,
  recordPassesPredicate,
  type RowLevelGuardContext,
  enforceFormMutationGate,
  resolveGuardForTable,
} from './row-level-guard'
import type { App, Table } from '@/domain/models/app'
import type {
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
  allTables?: App['tables']
) {
  if (hasCreatePermissionForRoles(table, effectiveRoles, allTables)) return undefined
  // Enumeration protection: users without read access get 404 (prevents resource discovery)
  const readTable = table as Parameters<typeof hasReadPermission>[0]
  if (!hasReadPermissionForRoles(readTable, effectiveRoles, allTables)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
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
    return checkCreatePermission(table, effectiveRoles, c, app.tables)
  }
  if (passesTableRoleGate(table?.permissions, 'create', guard.effectiveRoles)) return undefined
  // Lack of read access collapses to 404 (enumeration safety).
  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
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
  if (recordPassesPredicate(table.rowLevelPermissions, 'create', fields, guard.current)) {
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
}

/**
 * Z-3 update gate helper: enumeration-safe write role-gate. Per S1, all
 * authz denials return 404 so the write-permission boundary is not
 * discoverable — uniform with the read-deny path.
 */
function checkWriteRoleGate(
  c: Context,
  table: Table | undefined,
  guard: RowLevelGuardContext
): Response | undefined {
  if (passesTableRoleGate(table?.permissions, 'write', guard.effectiveRoles)) return undefined
  return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
}

interface WritePredicateInput {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext
}

/** Helper: evaluate write.when against an existing row. */
async function checkWritePredicate(input: WritePredicateInput): Promise<Response | undefined> {
  const { c, table, session, tableName, recordId, guard } = input
  if (!table?.rowLevelPermissions?.write?.when) return undefined
  const fetched = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  if (fetched._tag === 'Failure' || !fetched.success) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return recordPassesPredicate(table.rowLevelPermissions, 'write', fetched.success, guard.current)
    ? undefined
    : c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
}

async function checkUpdateGateAndPredicate(input: UpdateGateInput): Promise<Response | undefined> {
  const { c, app, table, session, tableName, userRole, userGroups, recordId, guard } = input

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

  return (
    checkWriteRoleGate(c, table, guard) ??
    (await checkWritePredicate({ c, table, session, tableName, recordId, guard }))
  )
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
}): Promise<Response | undefined> {
  const { c, app, tableName, userRole, userGroups, session, recordId } = input
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table, app)

  if (guard) {
    return enforceFormMutationGate({
      c,
      table,
      session,
      tableName,
      recordId,
      guard,
      op: 'write',
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
