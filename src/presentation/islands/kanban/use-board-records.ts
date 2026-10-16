/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { useBoardWindow, type BoardPagination } from './use-board-window'
import { useKanbanRecords } from './use-kanban-records'
import type { RecordsDataSource } from '../hooks/use-records-query'
import type { TableRecord } from '../runtime/types'

/**
 * The records the board draws: its own copy, so a drop appears before the
 * PATCH lands, re-synced whenever the query returns fresh data.
 */
export function useBoardRecords(
  dataSource: (RecordsDataSource & { readonly pagination?: BoardPagination }) | undefined
) {
  const { data, isLoading, isError, error } = useKanbanRecords(dataSource)
  const [localRecords, setLocalRecords] = useState<readonly TableRecord[]>([])
  // Re-synced DURING render rather than in an effect, so the board never draws
  // one frame of empty columns between the read landing and its copy.
  const [syncedFrom, setSyncedFrom] = useState<readonly TableRecord[] | undefined>(undefined)
  if (data?.records !== undefined && data.records !== syncedFrom) {
    setSyncedFrom(data.records)
    setLocalRecords(data.records)
  }
  return {
    localRecords,
    setLocalRecords,
    // The cards drawn: all of them, or the pages an `infinite` board has revealed.
    ...useBoardWindow(localRecords, dataSource?.pagination),
    isLoading,
    isError,
    error,
  }
}
