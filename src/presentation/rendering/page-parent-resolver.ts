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

import type { Page } from '@/domain/models/app/pages'
import type { DataSourceDb } from '@/presentation/rendering/data-source-resolver'

/**
 * Outcome of resolving a page's host record.
 *
 * - `record` — `mode: 'single'` returned a row. Expose to inline-prefill.
 * - `not-found` — `mode: 'single'` produced no row → 404 the page.
 * - `none` — no dataSource (or list/search mode); no parent context to
 *   expose. The form-ref expander should fall through to declarative
 *   defaults.
 */
export type PageParentResolution =
  | { readonly kind: 'record'; readonly record: Readonly<Record<string, unknown>> }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'none' }

/**
 * Resolve a page-level `dataSource: { mode: 'single' }` declaration into
 * the parent record exposed to `inlinePrefill` resolvers. Returns `none`
 * for absent or non-single dataSources so the form-ref expander falls
 * back to its declarative defaults; returns `not-found` so the caller
 * can 404 the page when the requested record doesn't exist (mirrors the
 * component-level single-mode behaviour in `resolvePageDataSources`).
 *
 * List-mode and search-mode page-level dataSources are intentionally
 * ignored at this tier: inline-create only needs a single host record
 * and broadening the contract here would force the form-ref expander to
 * grow per-record iteration. A follow-up tier can revisit when a
 * concrete use case appears.
 */
export async function resolvePageParentRecord(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  db: DataSourceDb
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
  if (paramValue === undefined) return { kind: 'not-found' }
  const record = await db.fetchSingleRecord(dataSource.table, paramName, paramValue)
  if (record === undefined) return { kind: 'not-found' }
  return { kind: 'record', record }
}
