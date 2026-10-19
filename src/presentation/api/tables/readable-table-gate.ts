/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readerRowsOf } from '@/application/use-cases/tables/row-read-admission'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { resolveGuardForTable } from './row-level-guard'
import { checkListReadGate } from './row-level-read-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Next } from 'hono'

/**
 * Refuse a table whose records list admits its caller no row — a table she may
 * read no field of — exactly as one that does not exist: the second half of
 * {@link refuseUnreadableTable}, for the routes that describe a table (its
 * permissions and its views) and answer its read gate themselves.
 */
export const refuseTableWithNoReaderRow =
  (resolveApp: () => App) =>
  async (c: Context, next: Next): Promise<Response | void> => {
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const reader = { session, role: userRole, groups: userGroups }
    const { admission } = await runDomainPromise(c, readerRowsOf(resolveApp(), tableName, reader))
    if (admission.kind === 'no-row') return notFound(c)
    return next()
  }

/**
 * Refuse a table its caller may not read BEFORE its query is judged, so the
 * list and aggregate routes answer such a table exactly as one that does not
 * exist, whatever the query asks — a malformed one included. The refusals are
 * the routes' own: the table's read gate (`checkListReadGate`), then the rows
 * the list admits her (`readerRowsOf`), of which there are none. A table she
 * may read passes on to the route, which asks both again for its answer.
 */
export const refuseUnreadableTable =
  (resolveApp: () => App) =>
  async (c: Context, next: Next): Promise<Response | void> => {
    const app = resolveApp()
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const table = app.tables?.find((candidate) => candidate.name === tableName)
    const caller = { userRole, userGroups }
    const guard = await resolveGuardForTable(c, session, caller, { table, app })
    const gateError = checkListReadGate({ c, app, table, userRole, userGroups, guard })
    if (gateError) return gateError
    return refuseTableWithNoReaderRow(resolveApp)(c, next)
  }
