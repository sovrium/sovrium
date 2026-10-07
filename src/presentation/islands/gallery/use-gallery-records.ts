/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useLazySharedFilter } from '../hooks/use-lazy-shared-filter'
import {
  buildFilterParam,
  useRecordsQuery,
  type RecordsDataSource,
} from '../hooks/use-records-query'

/**
 * Fetches records for the gallery component in a single page.
 *
 * Galleries display their records up-front as a card grid, in a single page:
 * no more than the binding's `limit`, the first ones in its sort order, and
 * the whole set when it declares none. With a
 * `dataSource.system` binding the rows come from a named read endpoint instead
 * of the DB-table records API. The gallery's row→card mapping stays in the
 * gallery components — this hook only owns the fetch.
 */
export function useGalleryRecords(dataSource: RecordsDataSource | undefined) {
  return useRecordsQuery(
    'gallery',
    dataSource,
    useLazySharedFilter(
      { bindTo: dataSource?.bindTo, sharedFilter: dataSource?.sharedFilter },
      buildFilterParam(dataSource?.filter)
    ),
    true
  )
}
