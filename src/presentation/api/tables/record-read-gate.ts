/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { authorizeRead } from '@/application/use-cases/tables/permissions/authorize-record-verbs'
import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { grantsForReadableRow } from '@/application/use-cases/tables/row-read-admission'
import { admitsRow } from '@/domain/models/app/tables/row-read-admission-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { guardForTable, type RowLevelGuardContext } from './row-level-guard'
import { checkGetReadGate, NOT_FOUND_RESPONSE } from './row-level-read-helpers'
import type { ReaderRows } from '@/application/use-cases/tables/row-read-admission'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Whether the records list admits the caller to the row `recordId` — a reader
 * it admits to no row of the table, or not to this one, is refused. Costs no
 * query outside a table listed in `auth.scopeTables`, and none at all when the
 * caller's rows were already read for this request (`rows`).
 */
const listAdmitsRow = (c: Context, app: App, table: Table, target: RecordTarget) => {
  const { recordId, rows } = target
  if (rows !== undefined) return Effect.succeed(admitsRow(rows.admission, recordId))
  const { session, userRole, userGroups } = getTableContext(c)
  const reader = { session, role: userRole, groups: userGroups }
  return Effect.match(grantsForReadableRow(app, table.name, reader, recordId), {
    onFailure: () => false,
    onSuccess: () => true,
  })
}

/** The record a gate judges, with the caller's rows when this request read them already. */
interface RecordTarget {
  readonly recordId: string
  readonly rows?: ReaderRows
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
 * stores as `1`/`0` is read as `true`/`false` first (`readStoredValues`), by
 * the read verdict (`authorizeRead`) every refusal of which is the 404.
 *
 * Returns the refusal, or `undefined` when the caller may proceed.
 */
export const checkRecordReadGate = (c: Context, app: App, table: Table, recordId: string) =>
  checkRecordReadGateFor(c, app, table, { recordId })

/**
 * {@link checkRecordReadGate} for a caller whose rows of the table this request
 * already read (`readerRowsOf`): passed as `target.rows`, her grants are not
 * read a second time.
 */
export const checkRecordReadGateFor = (c: Context, app: App, table: Table, target: RecordTarget) =>
  Effect.gen(function* () {
    const { recordId } = target
    const { session, userRole, userGroups } = getTableContext(c)
    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)
    const gateError = checkGetReadGate({ c, app, table, userRole, userGroups, guard })
    if (gateError) return gateError
    if (!(yield* listAdmitsRow(c, app, table, target))) return NOT_FOUND_RESPONSE(c)
    if (!rowRuleHolds(guard, table)) return undefined
    // effect-swallow: a row that cannot be read is refused as a missing one (S1).
    const fetched = yield* Effect.result(rawGetRecordProgram(session, table.name, recordId, app))
    if (fetched._tag === 'Failure' || !fetched.success) return NOT_FOUND_RESPONSE(c)
    const record = readStoredValues(table, fetched.success)
    // effect-swallow: a rule that cannot be judged refuses, as a missing record is (S1).
    const verdict = yield* Effect.result(authorizeRead(table, guard, record))
    return verdict._tag === 'Success' && verdict.success._tag === 'Allowed'
      ? undefined
      : NOT_FOUND_RESPONSE(c)
  })
