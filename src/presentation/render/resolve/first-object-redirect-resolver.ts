/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  fillHrefTemplate,
  findFirstObjectSource,
  type FirstObjectSource,
} from '@/domain/models/app/pages/first-object-redirect'
import { flattenRecordFields } from '@/domain/models/app/pages/record-envelope'
import { readRowsForCaller } from './record-read-gate'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

/**
 * Reads one page of rows from a system read ENDPOINT, server-side.
 *
 * Injected rather than implemented here because the presentation layer knows
 * neither the request origin nor the caller's cookies, and both are required:
 * a redirect computed from rows the visitor cannot see would leak the existence
 * of the first object. The live implementation lives beside the Hono context in
 * `page-render-pipeline.ts` and forwards the request's own credentials.
 *
 * Absent (a caller with no HTTP context — a unit test, a static build) the
 * redirect simply does not fire and the page renders, which is the same
 * degradation as an empty collection.
 */
export type SystemRowsFetcher = (
  endpoint: string,
  rowsKey: string
) => Promise<readonly Record<string, unknown>[]>

/** What reading the first row needs: the visitor, and the readers to read with. */
interface FirstRowContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
  readonly fetchSystemRows?: SystemRowsFetcher
}

/**
 * Resolve `page.redirectToFirst` into a redirect target, or `undefined` to
 * render the page.
 *
 * A collection path with one obvious destination per object has nothing useful
 * to show at the bare path — the navigation already lists the objects, so a
 * picker there is a second copy of it. This answers that path with the first
 * resolved row instead.
 *
 * `undefined` — render the page — is returned for EVERY unresolved case, and
 * the empty collection is the one that matters: a redirect with no row to point
 * at could 302 to a broken path or loop, so the page renders and its own empty
 * state is what the operator sees. The same reasoning covers an unreachable
 * source, a failed read, and a template whose placeholders the first row cannot
 * fill.
 *
 * The first row is the first one the records API would list the visitor: the
 * Location header names it whatever the page then shows, so a table she may
 * not read offers none and a row its row-level rule hides from her is skipped
 * (`readRowsForCaller`, the records gate every server-side read goes through).
 */
export async function resolveFirstObjectRedirect(
  page: Page,
  ctx: FirstRowContext
): Promise<string | undefined> {
  const { redirectToFirst } = page
  if (redirectToFirst === undefined) return undefined

  const source = findFirstObjectSource(page)
  if (source === undefined) return undefined

  const first = await readFirstRow(source, ctx)
  if (first === undefined) return undefined

  return fillHrefTemplate(redirectToFirst.hrefTemplate, flattenRecordFields(first))
}

/**
 * Read the first row of the resolved source, or `undefined` when there is none.
 *
 * A read that THROWS degrades to "no first row" rather than propagating: this
 * runs on the render path of a page that is perfectly renderable, so an
 * endpoint hiccup must cost the redirect, never the page.
 */
async function readFirstRow(
  source: FirstObjectSource,
  ctx: FirstRowContext
): Promise<Readonly<Record<string, unknown>> | undefined> {
  if (source.kind === 'table') {
    const { rows } = await readRowsForCaller({
      app: ctx.app,
      tableName: source.table,
      session: ctx.session,
      db: ctx.db,
      query: { pageSize: 1, page: 1 },
    }).catch(() => ({ rows: [] }))
    return rows[0]
  }
  if (ctx.fetchSystemRows === undefined) return undefined
  const rows = await ctx.fetchSystemRows(source.endpoint, source.rowsKey).catch(() => [])
  return rows[0]
}
