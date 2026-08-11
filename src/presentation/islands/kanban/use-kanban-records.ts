/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRecordsQuery, type RecordsDataSource } from '../hooks/use-records-query'

/**
 * Fetches all records for the kanban board in a single page.
 *
 * Kanban boards display all records up-front (grouped into columns); the shared
 * records query requests a large single page rather than paginating client-side.
 * With a `dataSource.system` binding the rows come from a named read endpoint
 * instead of the DB-table records API. The board's row→card grouping stays in
 * the kanban components — this hook only owns the fetch.
 */
export function useKanbanRecords(dataSource: RecordsDataSource | undefined) {
  return useRecordsQuery('kanban', dataSource)
}
