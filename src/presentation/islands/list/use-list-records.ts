/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  useRecordsPagesQuery,
  type RecordsDataSource,
  type RecordsPages,
} from '../hooks/use-records-query'

/**
 * Data-source shape accepted by the list island. A type alias of the shared
 * `RecordsDataSource` — re-exported under the list-specific name the island
 * imports for its `dataSource` prop type.
 */
export type ListRecordsDataSource = RecordsDataSource

/**
 * Fetches the list's items, one page at a time.
 *
 * A list declaring no `dataSource.limit` asks for a page big enough to hold the
 * whole set, so it renders every item up-front and has nothing left to load —
 * the behaviour every list had before paging existed. A list that DOES declare
 * a limit receives exactly that many items and can ask for the next page, which
 * is what `listDisplay.loadMore` spends.
 *
 * With a `dataSource.system` binding the rows come from a named read endpoint
 * instead of the DB-table records API, paged the same way. The list's row→item
 * mapping stays in the list/search renderers — this hook only owns the fetch.
 */
export function useListRecords(dataSource: ListRecordsDataSource | undefined): RecordsPages {
  return useRecordsPagesQuery('list', dataSource)
}
