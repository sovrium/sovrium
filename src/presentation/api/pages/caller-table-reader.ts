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
  buildGuestSession,
  buildSyntheticSession,
} from '@/application/use-cases/automations/build-guest-session'
import { relatedReaderOf } from '@/application/use-cases/tables/linked-row-visibility'
import {
  loadCurrentUserContext,
  rowRuleScopeOf,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { enrichRecordsWithRelatedLabels } from '@/application/use-cases/tables/record-link-enrichment'
import {
  createGetPermissionsProgram,
  getViewProgram,
  listViewsProgram,
  type TableCaller,
} from '@/application/use-cases/tables/table-operations'
import { GUEST_USER_ID, isGuestSession } from '@/domain/models/app/auth/guest-session'
import { callerReaderFromSession } from '@/domain/models/app/tables/caller-record-gate-service'
import { decodeUserListValuesIn } from '@/domain/models/app/tables/user-list-field-service'
import { logError } from '@/infrastructure/logging/logger'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import type {
  CallerTableView,
  LoadRowRuleContext,
  ReadRecordLabels,
  ReadTableAsCaller,
} from '@/application/ports/services/page-renderer'
import type { TransformedRecord } from '@/application/use-cases/tables/record-transformer'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'
import type { Context } from 'hono'

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

/**
 * The reader the records API would label a record for: the session's role and
 * groups, or the signed-out visitor. An app without auth reads everything, as
 * its pages do.
 */
function labelReaderOf(app: Parameters<ReadRecordLabels>[0], session: SessionInfo | undefined) {
  const reader = callerReaderFromSession(session, app)
  if (reader !== undefined && !isGuestSession(reader.userId)) {
    return {
      session: buildSyntheticSession(reader.userId),
      role: reader.role,
      groups: reader.groups,
    }
  }
  return {
    session: buildGuestSession(),
    role: app.auth === undefined ? 'admin' : 'guest',
    groups: [],
  }
}

/**
 * A bound record's `_display` labels — a `user` field's person, a relationship's
 * linked record — computed by the records API's own enrichment, on this
 * request's services, so a page names exactly what `GET /records/:id` names its
 * reader: a related record she may not read, or a display field she may not
 * read, stays unnamed.
 */
const recordLabelReader =
  (c: Context): ReadRecordLabels =>
  async (app, tableName, record, session) => {
    const { id } = record
    if (id === undefined || id === null) return undefined
    const reader = labelReaderOf(app, session)
    // A raw row: on SQLite a list of people is still its JSON text.
    const fields = decodeUserListValuesIn(app.tables, tableName, record)
    const stored = { id: String(id), fields, createdAt: '', updatedAt: '' }
    const answer = await runOnRequest(
      c,
      enrichRecordsWithRelatedLabels(app, tableName, [stored as TransformedRecord], {
        reader: relatedReaderOf(reader),
        linkReader: reader,
      }).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            logError(`[pages] labels of a ${tableName} record could not be read`, cause)
          })
        )
      )
    )
    // effect-swallow: see the tap above. The page still renders, its user and
    // relationship fields reading as their stored ids rather than failing it.
    if (answer._tag !== 'Success') return undefined
    return (answer.success[0] as { readonly _display?: Record<string, string> } | undefined)
      ?._display
  }

/** The memo key of a row-rule context: everything it is built from, so two readers never share one. */
const rowRuleContextKey = (tableName: string, reader: Parameters<LoadRowRuleContext>[2]): string =>
  JSON.stringify(
    reader === undefined
      ? [tableName]
      : [tableName, reader.userId, reader.role, reader.isUnrestricted === true, reader.email]
  )

/**
 * A table's row-rule context for one reader, loaded as the records API loads
 * it (`loadCurrentUserContext`, in the table's scope) on this request's
 * services — once per table and reader for the whole request, however many
 * components and lookups ask. A signed-out reader gets the signed-out context.
 */
const rowRuleContextLoader = (c: Context): LoadRowRuleContext => {
  const loaded = new Map<string, Promise<CurrentUserContext>>()
  return (app, tableName, reader) => {
    const key = rowRuleContextKey(tableName, reader)
    const cached = loaded.get(key)
    if (cached !== undefined) return cached
    const table = app.tables?.find((candidate) => candidate.name === tableName)
    const projection =
      reader === undefined
        ? { userId: GUEST_USER_ID, role: GUEST_USER_ID, isUnrestricted: false }
        : {
            userId: reader.userId,
            role: reader.role,
            isUnrestricted: reader.isUnrestricted === true,
            ...(reader.email === undefined ? {} : { email: reader.email }),
          }
    const scope = table === undefined ? undefined : rowRuleScopeOf(table, app.tables)
    const context = runOnRequest(
      c,
      loadCurrentUserContext(projection, table?.rowLevelPermissions, scope)
    ).then((answer) => {
      if (answer._tag === 'Success') return answer.success
      throw new Error(`the row-rule context of ${tableName} could not be loaded`)
    })
    loaded.set(key, context)
    return context
  }
}

/** The table API's answers a page render carries for this request. */
export const callerTableReaders = (c: Context) => ({
  readTableAsCaller,
  readRecordLabels: recordLabelReader(c),
  loadRowRuleContext: rowRuleContextLoader(c),
})
