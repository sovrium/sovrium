/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findMatchingRoute } from '@/domain/utils/matching/route-matcher'
import { hasReadPermissionForRoles } from '@/domain/validators/permission-evaluators'
import type { App, Page, Table } from '@/domain/models/app'

/**
 * Anti-enumeration guard for shared-view links (PG-03 / [internal ref]).
 *
 * When a request URL carries `?userView=<id>` and the matched page binds a
 * data-table to a table the requesting session cannot read, the page must
 * 404 — same response shape as a non-existent page — so an attacker cannot
 * use shared links to enumerate either tables or views the requester lacks
 * permission for.
 *
 * The guard is intentionally scoped to the `userView` signal:
 *
 *  - **No `userView` param** ⇒ fall through. A user with no read on
 *    `financials` who navigates directly to `/financials` should see the
 *    page's own access guard fire (which the page-level renderer already
 *    handles — `checkPageAccess` + the data-table's own row-level guard).
 *
 *  - **`userView` param present** ⇒ treat the request as a deliberate
 *    shared-link attempt. Any data-table on the page that binds to a table
 *    the session cannot read short-circuits to 404 before render.
 *
 * Walking only the top-level page components (not nested sections) is the
 * conservative choice — the spec's failure shape uses a top-level data-table
 * and adding nested support would broaden the surface area without a test to
 * pin the behaviour. Future cycles can deepen the walk when needed.
 *
 * Returns `true` when the request must 404; `false` when render should
 * proceed normally.
 */
export function isSharedViewAccessDenied(
  app: App,
  path: string,
  query: string,
  session: { readonly role: string; readonly effectiveRoles?: readonly string[] } | undefined
): boolean {
  if (!hasUserViewParam(query)) return false
  const matchedPage = findPageForPath(app, path)
  if (!matchedPage) return false
  const tableNames = collectDataTableTableNames(matchedPage)
  if (tableNames.length === 0) return false
  // Effective roles for the permission gate. When the session carries the
  // pre-resolved overlay (hydrated by `buildGetSession`), use it so
  // group-only read grants pass through; otherwise fall back to the
  // session's single global role (or `'viewer'` for anonymous callers).
  // This closes the asymmetry with the share-API path
  // (`src/application/use-cases/tables/user-views/get-shared-view.ts`) so a
  // user the API would 200 cannot get a page-level 404 for the same view.
  const effectiveRoles = resolveEffectiveRoles(session)
  return tableNames.some((tableName) => {
    const table = findTable(app, tableName)
    if (!table) return false
    return !hasReadPermissionForRoles(table, effectiveRoles, app.tables)
  })
}

function resolveEffectiveRoles(
  session: { readonly role: string; readonly effectiveRoles?: readonly string[] } | undefined
): readonly string[] {
  if (session?.effectiveRoles && session.effectiveRoles.length > 0) {
    return session.effectiveRoles
  }
  return [session?.role ?? 'viewer']
}

function findTable(app: App, name: string): Table | undefined {
  return (app.tables ?? []).find((t) => t.name === name)
}

function findPageForPath(app: App, path: string): Page | undefined {
  if (!app.pages || app.pages.length === 0) return undefined
  const patterns = app.pages.map((p) => p.path)
  const match = findMatchingRoute(patterns, path)
  if (!match) return undefined
  return app.pages[match.index]
}

/**
 * Parse the query string for a non-empty `userView` param. Accepts the bare
 * form Hono surfaces (`'foo=bar&userView=abc'`, no leading `?`).
 */
function hasUserViewParam(query: string): boolean {
  if (query === '') return false
  const params = new URLSearchParams(query)
  const param = params.get('userView')
  return param !== null && param !== ''
}

/**
 * Walk the page's top-level components and collect the `dataSource.table`
 * names every `type: 'data-table'` component binds to. Returns each name
 * once (dedup) so callers can iterate without re-checking the same table
 * twice.
 */
function collectDataTableTableNames(page: Page): readonly string[] {
  const components = page.components ?? []
  const names = components.flatMap((item) => extractTableName(item))
  return Array.from(new Set(names))
}

/**
 * Pull the `dataSource.table` name off a single component entry IFF it is a
 * `data-table`. Uses narrow duck-typing because the page component type is
 * a discriminated union and we want to stay decoupled from the precise
 * decoded shape (which has refs / sections / partial structures the union
 * widens over).
 */
function extractTableName(item: unknown): readonly string[] {
  if (!isComponentRecord(item)) return []
  if (item['type'] !== 'data-table') return []
  const { dataSource } = item
  if (!isComponentRecord(dataSource)) return []
  const { table } = dataSource
  return typeof table === 'string' && table !== '' ? [table] : []
}

function isComponentRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object'
}
