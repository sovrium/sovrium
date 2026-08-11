/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRecordsQuery, type RecordsDataSource } from '../hooks/use-records-query'

/**
 * Fetches all records for the calendar view in a single page.
 *
 * Calendars display all records up-front (positioned on date cells); the shared
 * records query requests a large single page rather than paginating. With a
 * `dataSource.system` binding the rows come from a named read endpoint instead
 * of the DB-table records API. The calendar's row→event mapping stays in the
 * calendar components — this hook only owns the fetch.
 */
export function useCalendarRecords(dataSource: RecordsDataSource | undefined) {
  return useRecordsQuery('calendar', dataSource)
}
