/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRecordsQuery, type RecordsDataSource } from '../hooks/use-records-query'

/**
 * Data-source shape accepted by the list island. A type alias of the shared
 * `RecordsDataSource` — re-exported under the list-specific name the island
 * imports for its `dataSource` prop type.
 */
export type ListRecordsDataSource = RecordsDataSource

/**
 * Fetches items for the list component in a single page.
 *
 * Lists render all items up-front via the `listDisplay.itemTemplate`; the shared
 * records query requests a large single page rather than paginating client-side.
 * With a `dataSource.system` binding the rows come from a named read endpoint
 * instead of the DB-table records API. The list's row→item mapping stays in the
 * list/search renderers — this hook only owns the fetch.
 */
export function useListRecords(dataSource: ListRecordsDataSource | undefined) {
  return useRecordsQuery('list', dataSource)
}
