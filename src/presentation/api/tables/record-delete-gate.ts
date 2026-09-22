/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { hasDeletePermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import {
  passesTableRoleGate,
  recordPassesPredicate,
  type RowLevelGuardContext,
} from './row-level-guard'
import type { App, Table } from '@/domain/models/app'
import type { getTableContext } from '@/presentation/api/runtime/context-helpers'
import type { Context } from 'hono'

export const NOT_FOUND_RESPONSE = (c: Context) =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

export const FORBIDDEN_DELETE_RESPONSE = (c: Context) =>
  // S1 anti-enumeration: delete-permission denials return 404 so the
  // delete-permission boundary is not discoverable. Uniform with read denials.
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

interface DeleteGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly userRole: string
  /** Group names the caller belongs to (un-prefixed) — group-aware RBAC. */
  readonly userGroups: readonly string[]
  readonly recordId: string
  readonly guard: RowLevelGuardContext | undefined
}

/** Predicate check that bundles read.when + delete.when against the same fetched row. */
function evaluateDeletePredicates(
  c: Context,
  table: Table,
  guard: RowLevelGuardContext,
  fetchedRecord: Readonly<Record<string, unknown>>
): Response | undefined {
  const rlp = table.rowLevelPermissions
  if (!rlp) return undefined
  if (rlp.read?.when && !recordPassesPredicate(rlp, 'read', fetchedRecord, guard.current)) {
    return NOT_FOUND_RESPONSE(c)
  }
  if (!passesTableRoleGate(table.permissions, 'delete', guard.effectiveRoles)) {
    return FORBIDDEN_DELETE_RESPONSE(c)
  }
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- `delete` is a property on RowLevelPermissions, not a Drizzle query.
  if (rlp.delete?.when && !recordPassesPredicate(rlp, 'delete', fetchedRecord, guard.current)) {
    return NOT_FOUND_RESPONSE(c)
  }
  return undefined
}

/**
 * Z-3 delete gate enforcing read.when before the delete role gate so
 * users who can't see the record always get 404 (enumeration safety),
 * even when their role lacks delete authority.
 */
export async function checkDeleteGate(input: DeleteGateInput): Promise<Response | undefined> {
  const { c, app, table, session, tableName, userRole, userGroups, recordId, guard } = input

  if (!guard) {
    // Group-aware, mirroring `checkUpdateGateAndPredicate` in
    // `record-write-handlers.ts`. The guarded branch below has always evaluated
    // `guard.effectiveRoles`; this one used a bare `userRole`, which no
    // `group:<name>` entry in `permissions.delete` could ever match — so a
    // `delete: ['group:ops']` grant was inert while the same grant worked for
    // update. The group overlay exists only in the effective-role set.
    const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
    if (!hasDeletePermissionForRoles(table, effectiveRoles, app.tables)) {
      return FORBIDDEN_DELETE_RESPONSE(c)
    }
    return undefined
  }

  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return NOT_FOUND_RESPONSE(c)
  }

  const fetched = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  if (fetched._tag === 'Failure' || !fetched.success) return NOT_FOUND_RESPONSE(c)
  if (!table) return NOT_FOUND_RESPONSE(c)

  return evaluateDeletePredicates(c, table, guard, fetched.success)
}
