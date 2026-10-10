/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { MAX_PAGE_SIZE } from '@/domain/kernel/sql/page-window'
import { toRecordsApiFilterParam } from '@/domain/models/app/pages/data-filter-api-service'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * A `mode: search` binding on `searchEngine: 'fts'`: the page ships its first
 * rows only, and the search island asks the records endpoint (`?q=`) for each
 * query, within the binding's own `filter` — the word search over the table's
 * `fullTextSearch` fields, or the substring search where it declares none.
 *
 * The other engine names keep the browser-side search over the rows the page
 * was sent, so this module answers `undefined` / `{}` for them.
 */

/** Whether a binding asks the database rather than filtering in the browser. */
const asksTheDatabase = (dataSource: Component['dataSource']): boolean =>
  dataSource?.searchEngine === 'fts'

/** The rows an `fts` binding shows at a time — its `limit`, within the endpoint's page cap. */
const pageSizeOf = (dataSource: Component['dataSource']): number =>
  Math.min(dataSource?.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE)

/** The SSR read cap of a search binding: its first page on `fts`, every row otherwise. */
export const ftsFirstRows = (
  dataSource: Component['dataSource']
): { readonly pageSize?: number } =>
  asksTheDatabase(dataSource) ? { pageSize: pageSizeOf(dataSource) } : {}

/** The island prop telling the search list where and how to ask, on `fts` only. */
export const ftsSearchProps = (
  dataSource: Component['dataSource']
): { readonly _searchServer?: string } => {
  if (!asksTheDatabase(dataSource) || typeof dataSource?.table !== 'string') return {}
  const filter = toRecordsApiFilterParam(dataSource.filter)
  return {
    _searchServer: JSON.stringify({
      table: dataSource.table,
      limit: pageSizeOf(dataSource),
      ...(filter !== undefined ? { filter } : {}),
    }),
  }
}
