/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react'
import { useUpdateRecord } from './use-table-mutations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditingCell {
  readonly rowId: string | number
  readonly field: string
  readonly value: unknown
}

export interface FieldMeta {
  readonly type: string
  readonly options?: readonly string[]
  readonly required?: boolean
}

export type FieldMetaMap = Readonly<Record<string, FieldMeta>>

interface UseInlineEditingParams {
  readonly tableName: string
  readonly fieldMeta?: FieldMetaMap
  readonly onSave?: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages inline editing state for data table cells.
 *
 * Handles entering/exiting edit mode and persisting changes via the API.
 * Uses TanStack Query useMutation for async saves with automatic
 * cache invalidation of table records.
 */
export function useInlineEditing(params: UseInlineEditingParams) {
  const { tableName, onSave } = params

  const [editingCell, setEditingCell] = useState<EditingCell | undefined>(undefined)
  const updateRecord = useUpdateRecord(tableName)

  const startEditing = useCallback(
    (rowId: string | number, field: string, currentValue: unknown) => {
      setEditingCell({ rowId, field, value: currentValue })
    },
    []
  )

  const cancelEditing = useCallback(() => {
    setEditingCell(undefined)
  }, [])

  const saveEdit = useCallback(
    async (newValue: unknown) => {
      if (!editingCell) return

      const { rowId, field } = editingCell

      try {
        // mutateAsync ensures the save completes before we exit edit mode,
        // guaranteeing the database is updated before the next assertion in E2E tests.
        await updateRecord.mutateAsync({
          recordId: String(rowId),
          fields: { [field]: newValue as string | number | boolean | null },
        })
        onSave?.()
      } finally {
        setEditingCell(undefined)
      }
    },
    [editingCell, updateRecord, onSave]
  )

  return {
    editingCell,
    startEditing,
    cancelEditing,
    saveEdit,
  }
}
