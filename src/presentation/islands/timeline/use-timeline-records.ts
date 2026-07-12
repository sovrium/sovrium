/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRecordsQuery, type RecordsDataSource } from '../hooks/use-records-query'

export function useTimelineRecords(dataSource: RecordsDataSource | undefined) {
  return useRecordsQuery('timeline', dataSource)
}
