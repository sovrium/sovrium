/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { recordPassesPredicate, resolveGuardForTable } from './row-level-guard'
import { checkGetReadGate, NOT_FOUND_RESPONSE } from './row-level-read-helpers'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Gate a route that reads or writes something ATTACHED to one record exactly
 * as `GET /records/:id` gates the record itself: the table's read grant, then
 * its row-level read rule judged against the record as it stands.
 *
 * The record's history and its comment thread (list, one comment, create,
 * edit, delete, mark read, mention picker) are part of the record, so a caller
 * must never learn from them what a read of the record would refuse. Every
 * refusal is the missing-record 404, body included (S1 anti-enumeration).
 *
 * A record the rule cannot be evaluated against — no longer in the table — is
 * refused to a scoped caller for the same reason. An unrestricted caller, or a
 * table with no row-level read rule, costs no record read: the route's own
 * existence check answers a missing record with the same 404.
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
  const guard = await resolveGuardForTable(session, { userRole, userGroups }, table, app)
  const gateError = checkGetReadGate({ c, app, table, userRole, userGroups, guard })
  if (gateError) return gateError
  if (!guard || !table.rowLevelPermissions?.read?.when || guard.current.isUnrestricted) {
    return undefined
  }
  const fetched = await runTableProgram(rawGetRecordProgram(session, table.name, recordId, app))
  if (fetched._tag === 'Failure' || !fetched.success) return NOT_FOUND_RESPONSE(c)
  const record = readStoredValues(table, fetched.success)
  return recordPassesPredicate(table.rowLevelPermissions, 'read', record, guard.current)
    ? undefined
    : NOT_FOUND_RESPONSE(c)
}
