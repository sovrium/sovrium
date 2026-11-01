/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  authorizeCreate,
  judgeTableGrant,
} from '@/application/use-cases/tables/permissions/authorize-record-verbs'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { refuseUnlistedRow } from './readable-table-gate'
import { checkTableUpdatePermissionWithRole } from './record-update-permissions'
import {
  createVerdictResponse,
  type RowLevelGuardContext,
  formMutationGate,
  guardForTable,
} from './row-level-guard'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { App, Table } from '@/domain/models/app'
import type { getTableContext } from '@/presentation/api/runtime/context-helpers'
import type { Context } from 'hono'

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
 * The create gate: the create verdict, mapped to 404 (no read access — the
 * table is not disclosed), the create refusal, or `undefined`. A table with
 * row-level rules judges the caller's effective roles (assignment roles
 * included); one without judges her account role and groups. The proposed row
 * is judged later, once validated ({@link checkCreatePredicate}).
 */
export function checkCreateGate(input: CreateGateInput): Response | undefined {
  const { c, app, table, userRole, userGroups, guard } = input
  const caller = guard ?? {
    effectiveRoles: buildEffectiveRoles(userRole, userGroups),
    allTables: app,
    signedOut: false,
  }
  return createVerdictResponse(c, judgeTableGrant(table, 'create', caller))
}

/**
 * The `create.when` check on the validated row: the create verdict for that
 * row, asked after {@link checkCreateGate} admitted the caller. An
 * out-of-scope create answers 404.
 */
export function checkCreatePredicate(
  c: Context,
  table: Table | undefined,
  guard: RowLevelGuardContext | undefined,
  fields: Readonly<Record<string, unknown>>
): Response | undefined {
  if (!guard || !table?.rowLevelPermissions) return undefined
  return createVerdictResponse(c, Effect.runSync(authorizeCreate(table, guard, [fields])))
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

const updateGateAndPredicate = (
  input: UpdateGateInput
): Effect.Effect<Response | undefined, never, TableRepository> => {
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
    return Effect.succeed(permissionCheck.allowed ? undefined : permissionCheck.response)
  }

  // The single-record gate the delete door asks: the read grant, the row
  // (missing answers 404), the write grant, then `read.when` AND `write.when`
  // on the row as it stands and `write.when` on the row as written. A row the
  // read rule hides from the caller is refused as a missing one, even where
  // the write rule admits it. Every denial is the missing row's 404 (S1).
  return formMutationGate({
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
 * Run all pre-mutation update gates in order: the Z-3 role/predicate gate,
 * then the check that her list of the table admits the record. Resolves the
 * first failing response, or `undefined` when the update may proceed. The
 * table's business rules are judged later, by the update itself
 * (`business-rule-gate.ts`).
 */
export const updateGates = (
  input: UpdateGateInput
): Effect.Effect<Response | undefined, never, TableRepository | DataSourceRepository> => {
  const { c, app, recordId } = input
  return Effect.filterOrElse(
    updateGateAndPredicate(input),
    (refusal) => refusal !== undefined,
    // A record her list of the table does not admit is a missing one.
    () => refuseUnlistedRow(c, app, recordId)
  )
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
export const formUpdateAuth = (input: {
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
}) => {
  const { c, app, tableName, userRole, userGroups, session, recordId, change } = input
  const table = app.tables?.find((t) => t.name === tableName)
  const gate = Effect.flatMap(
    guardForTable(session, { userRole, userGroups }, table, app),
    (guard): Effect.Effect<Response | undefined, never, TableRepository> => {
      if (guard) {
        return formMutationGate({
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
      return Effect.succeed(permissionCheck.allowed ? undefined : permissionCheck.response)
    }
  )
  // A record her list of the table does not admit is a missing one.
  return Effect.filterOrElse(
    gate,
    (refusal) => refusal !== undefined,
    () => refuseUnlistedRow(c, app, recordId)
  )
}
