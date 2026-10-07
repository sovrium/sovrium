/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useLazySharedFilter } from '../hooks/use-lazy-shared-filter'
import { useLiveRefresh } from '../hooks/use-realtime-subscription'
import {
  buildFilterParam,
  useRecordsQuery,
  type RecordsDataSource,
} from '../hooks/use-records-query'

/**
 * Fetches all records for the kanban board in a single page.
 *
 * Kanban boards display all records up-front (grouped into columns); the shared
 * records query requests a large single page rather than paginating client-side.
 * With a `dataSource.system` binding the rows come from a named read endpoint
 * instead of the DB-table records API. The board's row→card grouping stays in
 * the kanban components — this hook only owns the fetch. A
 * `dataSource.refreshMode` reads the board again on its interval or on a change
 * to the table (`useLiveRefresh`).
 */
export function useKanbanRecords(dataSource: RecordsDataSource | undefined) {
  const query = useRecordsQuery(
    'kanban',
    dataSource,
    useLazySharedFilter(
      { bindTo: dataSource?.bindTo, sharedFilter: dataSource?.sharedFilter },
      buildFilterParam(dataSource?.filter)
    )
  )
  useLiveRefresh(dataSource, query.refetch)
  return query
}
