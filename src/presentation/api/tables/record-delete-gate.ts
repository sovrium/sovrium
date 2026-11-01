/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { refuseUnlistedRow } from './readable-table-gate'
import {
  formMutationGate,
  passesUnguardedTableGate,
  type RowLevelGuardContext,
} from './row-level-guard'
import type { App, Table } from '@/domain/models/app'
import type { getTableContext } from '@/presentation/api/runtime/context-helpers'
import type { Context } from 'hono'

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

/**
 * The single-record delete door. Under row-level rules it answers the delete
 * verdict (`authorizeDelete`): every refusal is the same 404 (enumeration
 * safety), even when the caller's role lacks delete authority. A record the caller's list of
 * the table does not admit is then refused as a missing one, and nothing is
 * deleted.
 */
export const checkDeleteGate = (input: DeleteGateInput) =>
  Effect.gen(function* () {
    const refusal = yield* checkDeleteGrantAndRules(input)
    if (refusal) return refusal
    const { c, app, recordId } = input
    return yield* refuseUnlistedRow(c, app, recordId)
  })

const checkDeleteGrantAndRules = (input: DeleteGateInput) => {
  const { c, app, table, session, tableName, userRole, userGroups, recordId, guard } = input

  if (!guard) {
    // Group-aware, mirroring `checkUpdateGateAndPredicate` in
    // `record-write-handlers.ts`. The guarded branch below has always evaluated
    // `guard.effectiveRoles`; this one used a bare `userRole`, which no
    // `group:<name>` entry in `permissions.delete` could ever match — so a
    // `delete: ['group:ops']` grant was inert while the same grant worked for
    // update. The group overlay exists only in the effective-role set.
    return Effect.succeed(
      passesUnguardedTableGate(app, table, { userRole, userGroups }, 'delete')
        ? undefined
        : // S1 anti-enumeration: a delete-permission denial is the missing-record 404.
          notFound(c)
    )
  }

  return formMutationGate({ c, table, session, tableName, recordId, guard, op: 'delete' })
}
