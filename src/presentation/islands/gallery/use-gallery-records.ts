/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRecordsQuery, type RecordsDataSource } from '../hooks/use-records-query'

/**
 * Fetches records for the gallery component in a single page.
 *
 * Galleries display all records up-front as a card grid; the shared records
 * query requests a large single page rather than paginating client-side. With a
 * `dataSource.system` binding the rows come from a named read endpoint instead
 * of the DB-table records API. The gallery's row→card mapping stays in the
 * gallery components — this hook only owns the fetch.
 */
export function useGalleryRecords(dataSource: RecordsDataSource | undefined) {
  return useRecordsQuery('gallery', dataSource)
}
