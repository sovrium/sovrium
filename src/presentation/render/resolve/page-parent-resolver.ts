/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Page-level `dataSource: { mode: 'single' }` resolution (Y-5).
 *
 * Lives in its own module so the broader `render-page.tsx` file stays
 * under the line cap. The helper below is the only piece of the renderer
 * that touches the `$parent` record exposed to embedded form-refs via
 * `inlinePrefill` — keeping it isolated also makes the contract obvious
 * (one fetch, one of three outcomes).
 */

import { readRecordForCaller } from '@/presentation/render/resolve/record-read-gate'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

/**
 * Outcome of resolving a page's host record.
 *
 * - `record` — `mode: 'single'` bound a row this visitor may read, already
 *   gated for her (`readRecordForCaller`): less the columns she may not read.
 *   Expose to inline-prefill.
 * - `not-found` — `mode: 'single'` bound no row she may read → 404 the page.
 *   A row that does not exist, one in the trash, and one the table's read
 *   permission or row-level rule keeps from her answer alike, so the page
 *   cannot be used to learn which ids exist (S1).
 * - `none` — no dataSource (or list/search mode); no parent context to
 *   expose. The form-ref expander should fall through to declarative
 *   defaults.
 */
export type PageParentResolution =
  | {
      readonly kind: 'record'
      readonly table: string
      readonly record: Readonly<Record<string, unknown>>
    }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'none' }

/** Who the host record is read for. */
export interface PageParentReader {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

/**
 * Resolve a page-level `dataSource: { mode: 'single' }` declaration into
 * the parent record exposed to `inlinePrefill` resolvers, read for THIS
 * visitor. Returns `none` for absent or non-single dataSources so the
 * form-ref expander falls back to its declarative defaults; returns
 * `not-found` so the caller can 404 the page.
 *
 * Which row is bound follows the component-level single binding
 * (`resolveSingleMode`): the route parameter's row, or — with no `param` and
 * no segment named after the table (`/system/growth`) — the first row the
 * visitor may read, a row hidden from her being passed over rather than
 * answered as missing. A declared `param` the path does not carry is
 * `not-found`.
 *
 * List-mode and search-mode page-level dataSources are intentionally
 * ignored at this tier: inline-create only needs a single host record.
 */
export async function resolvePageParentRecord(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  reader: PageParentReader
): Promise<PageParentResolution> {
  const { dataSource } = page as {
    readonly dataSource?: {
      readonly table: string
      readonly mode?: string
      readonly param?: string
    }
  }
  if (dataSource === undefined) return { kind: 'none' }
  if (dataSource.mode !== 'single') return { kind: 'none' }
  const paramName = dataSource.param ?? dataSource.table
  const paramValue = routeParams[paramName]
  if (paramValue === undefined && dataSource.param !== undefined) return { kind: 'not-found' }
  // A trashed row answers as missing, as it does on the records API.
  const record = await readRecordForCaller({
    ...reader,
    tableName: dataSource.table,
    at: paramValue === undefined ? 'first-readable' : { field: paramName, value: paramValue },
  })
  if (record === undefined) return { kind: 'not-found' }
  return { kind: 'record', table: dataSource.table, record }
}
