/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The table's read gate, run BEFORE anything else looks at the request.
 *
 * One rule: a value the caller may not read is never hers to change, nor
 * handed back to her. On a table the caller may not read, every route that
 * reads, or writes to, what the table already holds answers exactly as a table
 * that does not exist — `404`, the same body — whatever the request's shape:
 *
 *  - the records list and a single record (a malformed `format`, `timezone` or
 *    list query included, so a validator never answers before the gate);
 *  - an update of an existing record by every door — PATCH, the edit form, the
 *    batch route, bulk-update — and an upsert, whose merge reads the table to
 *    find its match (answering a match `404` and a miss `200` would tell the
 *    caller which records exist);
 *  - a delete of an existing record by every door — DELETE, the delete form,
 *    both batch delete routes, bulk-delete — so a stored record answers as a
 *    missing one, and nothing is deleted;
 *  - the caller's saved views and preferences on the table;
 *  - a view's records, judged by the view's own grant (or the table's, when
 *    the view declares none), so a malformed `order` meets the gate first.
 *
 * A create is the exception: a caller granted `create` on a table she may not
 * read files a record (the records-API twin of a public form), one at a time
 * or by the batch route. Any refusal of her body that would describe the
 * table — a malformed body, an unknown or missing field, a value the column
 * refuses, a duplicate of a unique value — answers the missing table's `404`
 * instead, and the answer to her create carries no value of the record, nor
 * its id (see `record-write-handlers.ts` and `batch-routes.ts`).
 */

import { viewReadAdmits } from '@/application/use-cases/tables/table-operations'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { findViewByKey } from '@/domain/models/app/tables/views/view-read-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { resolveAccessRolesFor, resolveGuardForTable } from './row-level-guard'
import { checkGetReadGate } from './row-level-read-helpers'
import type { App, Table } from '@/domain/models/app'
import type { Context, Next } from 'hono'

/**
 * Whether the caller passes the table's records read gate — the very gate
 * `GET /records/:id` asks: the table's effective `read` over the caller's role,
 * groups and, under row-level rules, `user_access` roles.
 */
export async function callerReadsTable(
  c: Context,
  app: App,
  table: Table | undefined
): Promise<boolean> {
  if (table === undefined) return false
  const { session, userRole, userGroups } = getTableContext(c)
  const guard = await resolveGuardForTable(session, { userRole, userGroups }, table, app)
  return checkGetReadGate({ c, app, table, userRole, userGroups, guard }) === undefined
}

/** What the gate must decide for a request, read off its method and path. */
type GateKind = 'table' | 'create' | 'view' | 'none'

/** Path words that sit where a record id would, on a POST, and read the table. */
const READING_POSTS: ReadonlySet<string> = new Set(['upsert', 'bulk-update', 'bulk-delete'])

/** Actions under `/records/:recordId/` a POST performs on what the table holds. */
const READING_ACTIONS: ReadonlySet<string> = new Set(['update', 'delete'])

/** `/records` itself: a list reads the table, a create files into it. */
const gateKindForCollection = (method: string): GateKind => {
  if (method === 'GET') return 'table'
  return method === 'POST' ? 'create' : 'none'
}

/** `/records/:recordId`: a read, an update or a delete of a record, or a reading POST word. */
const gateKindForRecord = (method: string, recordId: string): GateKind => {
  if (method === 'GET' || method === 'PATCH' || method === 'DELETE') return 'table'
  if (method !== 'POST') return 'none'
  if (recordId === 'batch') return 'create'
  return READING_POSTS.has(recordId) ? 'table' : 'none'
}

const gateKindForRecords = (method: string, segments: readonly string[]): GateKind => {
  const [, recordId, action] = segments
  if (recordId === undefined) return gateKindForCollection(method)
  if (action === undefined) return gateKindForRecord(method, recordId)
  return method === 'POST' && READING_ACTIONS.has(action) && segments.length === 3
    ? 'table'
    : 'none'
}

/** The gate a request beneath `/api/tables/:tableId` must pass first. */
const gateKindFor = (method: string, segments: readonly string[]): GateKind => {
  const [head] = segments
  if (head === 'user-views' || head === 'user-preferences') return 'table'
  if (head === 'records') return gateKindForRecords(method, segments)
  if (head === 'views' && method === 'GET' && segments.length === 3 && segments[2] === 'records') {
    return 'view'
  }
  return 'none'
}

/** The request path's segments beneath `/api/tables/:tableId`. */
const segmentsBelowTable = (path: string): readonly string[] =>
  path
    .split('/')
    .filter((segment) => segment.length > 0)
    .slice(3)

/** The statuses of a create refusal that describes the table's shape or contents. */
const DESCRIBING_REFUSALS: ReadonlySet<number> = new Set([400, 409, 422])

/** Run a create for a caller who may not read the table, masking what would describe it. */
const createWithoutRead = async (c: Context, next: Next): Promise<void> => {
  await next()
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, no-param-reassign -- Hono's middleware contract replaces the response by assignment
  if (DESCRIBING_REFUSALS.has(c.res.status)) c.res = notFound(c)
}

/** Whether the caller passes the grant of the view a `/views/:viewId/records` read names. */
const callerReadsView = async (
  c: Context,
  app: App,
  table: Table,
  viewId: string
): Promise<boolean> => {
  const view = findViewByKey(table.views, viewId)
  if (view === undefined) return true // the route answers a missing view itself
  const { session, userRole, userGroups } = getTableContext(c)
  const accessRoles = await resolveAccessRolesFor(session, [table])
  return viewReadAdmits(app, table, view, {
    role: userRole,
    groups: userGroups,
    accessRoles,
    anonymous: isGuestSession(session?.userId),
  })
}

/**
 * Middleware mounted on `/api/tables/:tableId/*` after the table and caller are
 * resolved, ahead of every route and its validators.
 */
export function gateUnreadableTable(resolveApp: () => App) {
  return async (c: Context, next: Next) => {
    const segments = segmentsBelowTable(c.req.path)
    const kind = gateKindFor(c.req.method, segments)
    if (kind === 'none') return next()
    const app = resolveApp()
    const table = app.tables?.find((t) => t.name === getTableContext(c).tableName)
    if (table === undefined) return next()
    if (kind === 'view') {
      return (await callerReadsView(c, app, table, segments[1] ?? '')) ? next() : notFound(c)
    }
    if (await callerReadsTable(c, app, table)) return next()
    return kind === 'create' ? createWithoutRead(c, next) : notFound(c)
  }
}
