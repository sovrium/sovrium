/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The public-view carve-out of the `/api/tables/*` session gate.
 *
 * A view declaring `permissions: { public: true }` is readable by a visitor
 * with no account, on exactly two routes:
 *   `GET /api/tables/:t/views/:v`          (its definition)
 *   `GET /api/tables/:t/views/:v/records`  (its rows)
 *
 * Everything else keeps the ordinary 401, and that includes the catalogue
 * `GET /api/tables/:t/views`: listing would name every view, private ones
 * with the filters each was drawn around. Only the `public` LITERAL opens a
 * view — `read: 'all'` on a view, or no permissions block, keep meaning "every
 * signed-in role". And the refusal is the same whether the view is private or
 * was never declared, so a visitor cannot tell the two apart (S1).
 *
 * What the visitor is served once through the gate — the view's `fields` and
 * no more, its filters applied on the server — is the view-records handler's
 * job; this module only opens the door.
 */

import { findViewByKey, isPublicView } from '@/domain/models/app/tables/views/view-read-service'
import type { Context } from 'hono'

const PUBLIC_VIEW_GET_PATH = /^\/api\/tables\/([^/]+)\/views\/([^/]+)\/?$/
const PUBLIC_VIEW_RECORDS_PATH = /^\/api\/tables\/([^/]+)\/views\/([^/]+)\/records\/?$/

/** The table and view a public-view read addresses. */
export interface PublicViewAddress {
  readonly tableKey: string
  readonly viewKey: string
}

/** A path segment as the router hands it to the handler; malformed escapes stay as written. */
const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * The table and view a request addresses, when it is a GET on one of the two
 * single-view read routes. Any other method or path — the catalogue included —
 * addresses nothing here.
 */
export function matchPublicViewRead(method: string, path: string): PublicViewAddress | undefined {
  if (method !== 'GET') return undefined
  const match = PUBLIC_VIEW_RECORDS_PATH.exec(path) ?? PUBLIC_VIEW_GET_PATH.exec(path)
  if (!match?.[1] || !match[2]) return undefined
  return { tableKey: decodeSegment(match[1]), viewKey: decodeSegment(match[2]) }
}

interface TableWithViews {
  readonly name?: unknown
  readonly id?: unknown
  readonly views?: ReadonlyArray<{
    readonly id: string | number
    readonly name: string
    readonly permissions?: unknown
  }>
}

/**
 * Whether the addressed view exists on the addressed table AND declares
 * `{ public: true }`. Tables and views are matched by id or name, as the
 * routes behind the gate match them.
 */
export function isPublicViewOf(
  app: { readonly tables?: ReadonlyArray<unknown> } | undefined,
  address: PublicViewAddress
): boolean {
  const table = (app?.tables ?? []).find((candidate): candidate is TableWithViews => {
    if (typeof candidate !== 'object' || candidate === null) return false
    const { name, id } = candidate as TableWithViews
    return name === address.tableKey || String(id ?? '') === address.tableKey
  })
  const view = findViewByKey(table?.views, address.viewKey)
  return view !== undefined && isPublicView(view)
}

/** Whether an anonymous request may pass the session gate as a public-view read. */
export function isPublicViewRead(
  c: Context,
  app: { readonly tables?: ReadonlyArray<unknown> } | undefined
): boolean {
  const address = matchPublicViewRead(c.req.method, c.req.path)
  return address !== undefined && isPublicViewOf(app, address)
}
