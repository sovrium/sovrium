/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { grantsForReadableRow } from '@/application/use-cases/tables/row-read-admission'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import {
  recordPassesPredicate,
  resolveGuardForTable,
  type RowLevelGuardContext,
} from './row-level-guard'
import { checkGetReadGate, NOT_FOUND_RESPONSE } from './row-level-read-helpers'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Whether the records list admits the caller to the row `recordId` — a reader
 * it admits to no row of the table, or not to this one, is refused. Costs no
 * query outside a table listed in `auth.scopeTables`.
 */
async function listAdmitsRow(
  c: Context,
  app: App,
  table: Table,
  recordId: string
): Promise<boolean> {
  const { session, userRole, userGroups } = getTableContext(c)
  const reader = { session, role: userRole, groups: userGroups }
  const admitted = await runOnRequest(c, grantsForReadableRow(app, table.name, reader, recordId))
  return admitted._tag === 'Success'
}

/** Whether the table's row-level read rule holds this caller. */
export const rowRuleHolds = (
  guard: RowLevelGuardContext | undefined,
  table: Table
): guard is RowLevelGuardContext =>
  guard !== undefined &&
  Boolean(table.rowLevelPermissions?.read?.when) &&
  !guard.current.isUnrestricted

/**
 * Gate a route that reads or writes something ATTACHED to one record exactly
 * as `GET /records/:id` gates the record itself: the table's read grant, then
 * the rows the records list admits its reader (`grantsForReadableRow` — a
 * reader admitted to no row, or not to this one, is refused), then its
 * row-level read rule judged against the record as it stands.
 *
 * The record's history and its comment thread (list, one comment, create,
 * edit, delete, mark read, mention picker) are part of the record, so a caller
 * must never learn from them what a read of the record would refuse. Every
 * refusal is the missing-record 404, body included (S1 anti-enumeration).
 *
 * A record the rule cannot be evaluated against — no longer in the table — is
 * refused to a scoped caller for the same reason. An unrestricted caller, or a
 * table with no row-level read rule, costs no record read: the route's own
 * existence check answers a missing record with the same 404. The row
 * admission costs no query either, outside a table listed in
 * `auth.scopeTables`.
 *
 * The record is judged as the records API reads it: a boolean field SQLite
 * stores as `1`/`0` is read as `true`/`false` first (`readStoredValues`).
 *
 * Returns the refusal, or `undefined` when the caller may proceed.
 */
export async function checkRecordReadGate(
  c: Context,
  app: App,
  table: Table,
  recordId: string
): Promise<Response | undefined> {
  const { session, userRole, userGroups } = getTableContext(c)
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })
  const gateError = checkGetReadGate({ c, app, table, userRole, userGroups, guard })
  if (gateError) return gateError
  if (!(await listAdmitsRow(c, app, table, recordId))) return NOT_FOUND_RESPONSE(c)
  if (!rowRuleHolds(guard, table)) return undefined
  const fetched = await runOnRequest(c, rawGetRecordProgram(session, table.name, recordId, app))
  if (fetched._tag === 'Failure' || !fetched.success) return NOT_FOUND_RESPONSE(c)
  const record = readStoredValues(table, fetched.success)
  return recordPassesPredicate(table.rowLevelPermissions, 'read', record, guard.current)
    ? undefined
    : NOT_FOUND_RESPONSE(c)
}
