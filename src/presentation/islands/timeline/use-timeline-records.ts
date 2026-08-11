/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRecordsQuery, type RecordsDataSource } from '../hooks/use-records-query'

/**
 * Fetches records for the data-timeline component in a single page.
 *
 * The timeline plots the records page envelope onto a time axis without
 * server-side aggregation; the shared records query requests a large single page
 * rather than paginating. With a `dataSource.system` binding the rows come from
 * a named read endpoint instead of the DB-table records API. The timeline's
 * row→bar mapping stays in the timeline components — this hook only owns the
 * fetch.
 */
export function useTimelineRecords(dataSource: RecordsDataSource | undefined) {
  return useRecordsQuery('timeline', dataSource)
}
