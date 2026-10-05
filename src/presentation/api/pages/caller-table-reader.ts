/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A table as the table API answers one caller, for the page renderer.
 *
 * A server-rendered grid hands its reader a payload she can read with "view
 * source": its views, its permission map, its field list. That payload must
 * say no more than `GET /api/tables/:t/views` and `GET /api/tables/:t/
 * permissions` say the same reader — so it is computed by those two routes'
 * own programs, here, where the use-cases are reachable and the renderer's
 * tree is not. The renderer receives the result through its request context
 * (`ReadTableAsCaller`) and never evaluates a permission of its own.
 *
 * The caller is the one those routes build (`resolveTableReadCaller`): the
 * session's role and groups, plus — on a table with row-level rules, where the
 * records route counts them — the `user_access` roles the page session already
 * carries as `effectiveRoles`. A request with no session is the visitor the
 * auth middleware names `guest`.
 */

import { Effect } from 'effect'
import {
  createGetPermissionsProgram,
  getViewProgram,
  listViewsProgram,
  type TableCaller,
} from '@/application/use-cases/tables/table-operations'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { callerReaderFromSession } from '@/domain/models/app/tables/caller-record-gate-service'
import type { CallerTableView, ReadTableAsCaller } from '@/application/ports/services/page-renderer'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/** The caller the views and permissions routes would answer for this session. */
function tableCallerOf(
  app: Parameters<ReadTableAsCaller>[0],
  session: SessionInfo | undefined
): TableCaller {
  const reader = callerReaderFromSession(session, app)
  if (reader === undefined || isGuestSession(reader.userId)) {
    return { role: 'guest', groups: [], anonymous: true }
  }
  return { role: reader.role, groups: reader.groups, accessRoles: reader.accessRoles }
}

/**
 * One view's definition as `GET /api/tables/:t/views/:v` answers the caller —
 * the view's own grant decides, so a public view answers a visitor — or
 * `undefined` where that route refuses her (or no view was named).
 */
async function boundViewFor(
  app: Parameters<ReadTableAsCaller>[0],
  tableName: string,
  ctx: { readonly caller: TableCaller; readonly view: string | undefined }
): Promise<CallerTableView['boundView']> {
  if (ctx.view === undefined) return undefined
  const answer = await Effect.runPromise(
    Effect.result(getViewProgram(tableName, ctx.view, app, ctx.caller))
  )
  return answer._tag === 'Success' ? (answer.success as CallerTableView['boundView']) : undefined
}

/** The routes' answers for one caller; a refusal answers as an empty view. */
export const readTableAsCaller: ReadTableAsCaller = async (
  app,
  tableName,
  session,
  view
): Promise<CallerTableView> => {
  const caller = tableCallerOf(app, session)
  const [views, permissions, boundView] = await Promise.all([
    Effect.runPromise(Effect.result(listViewsProgram(tableName, app, caller))),
    Effect.runPromise(Effect.result(createGetPermissionsProgram(tableName, app, caller))),
    boundViewFor(app, tableName, { caller, view }),
  ])
  return {
    views: views._tag === 'Success' ? views.success : [],
    permissionMap: permissions._tag === 'Success' ? permissions.success : undefined,
    ...(view !== undefined && { boundView }),
  }
}
