/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useUpdateRecord } from './use-table-mutations'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'


export interface EditingCell {
  readonly rowId: string | number
  readonly field: string
  readonly value: unknown
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveTarget {
  readonly rowId: string | number
  readonly field: string
}

export interface FieldMeta {
  readonly type: string
  readonly options?: readonly string[]
  readonly required?: boolean
}

export type FieldMetaMap = Readonly<Record<string, FieldMeta>>

interface PendingSave {
  readonly rowId: string | number
  readonly field: string
  readonly value: unknown
}

interface UseInlineEditingParams {
  readonly tableName: string
  readonly fieldMeta?: FieldMetaMap
  readonly onSave?: () => void
  readonly autoSave?: AutoSaveConfig
}


const SAVED_DISMISS_MS = 2000

function useSavedStatusTimer(onDismiss: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const cancelDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const scheduleDismiss = useCallback(() => {
    cancelDismiss()
    timerRef.current = setTimeout(onDismiss, SAVED_DISMISS_MS)
  }, [cancelDismiss, onDismiss])

  useEffect(() => cancelDismiss, [cancelDismiss])

  return { scheduleDismiss, cancelDismiss }
}

function useFieldPersistence(tableName: string, onSave?: () => void) {
  const [saveError, setSaveError] = useState<string | undefined>(undefined)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveTarget, setSaveTarget] = useState<SaveTarget | undefined>(undefined)
  const updateRecord = useUpdateRecord(tableName)

  const pendingSaveRef = useRef<PendingSave | undefined>(undefined)
  const dismissToIdle = useCallback(() => setSaveStatus('idle'), [])
  const { scheduleDismiss, cancelDismiss } = useSavedStatusTimer(dismissToIdle)

  const persistField = useCallback(
    async (rowId: string | number, field: string, value: unknown): Promise<boolean> => {
      pendingSaveRef.current = undefined
      cancelDismiss()
      setSaveTarget({ rowId, field })
      setSaveStatus('saving')
      try {
        await updateRecord.mutateAsync({
          recordId: String(rowId),
          fields: { [field]: value as string | number | boolean | null },
        })
        setSaveError(undefined)
        setSaveStatus('saved')
        scheduleDismiss()
        onSave?.()
        return true
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save changes')
        setSaveStatus('error')
        return false
      }
    },
    [updateRecord, onSave, cancelDismiss, scheduleDismiss]
  )

  const flushPendingSave = useCallback(async () => {
    const pending = pendingSaveRef.current
    if (!pending) return
    await persistField(pending.rowId, pending.field, pending.value)
  }, [persistField])

  const trackPendingValue = useCallback((pending: PendingSave) => {
    pendingSaveRef.current = pending
  }, [])

  return {
    saveError,
    saveStatus,
    saveTarget,
    persistField,
    flushPendingSave,
    trackPendingValue,
  }
}


type Persistence = ReturnType<typeof useFieldPersistence>

function useEditingState(persistence: Persistence, isAutoSave: boolean) {
  const { persistField, flushPendingSave, trackPendingValue } = persistence
  const [editingCell, setEditingCell] = useState<EditingCell | undefined>(undefined)

  const startEditing = useCallback(
    (rowId: string | number, field: string, currentValue: unknown) => {
      if (isAutoSave) void flushPendingSave()
      setEditingCell({ rowId, field, value: currentValue })
    },
    [isAutoSave, flushPendingSave]
  )

  const cancelEditing = useCallback(() => setEditingCell(undefined), [])

  const saveEdit = useCallback(
    async (newValue: unknown) => {
      if (!editingCell) return
      try {
        await persistField(editingCell.rowId, editingCell.field, newValue)
      } finally {
        setEditingCell(undefined)
      }
    },
    [editingCell, persistField]
  )

  const autoSaveEdit = useCallback(
    async (newValue: unknown) => {
      if (editingCell) await persistField(editingCell.rowId, editingCell.field, newValue)
    },
    [editingCell, persistField]
  )

  const trackValue = useCallback(
    (newValue: unknown) => {
      if (editingCell) {
        trackPendingValue({ rowId: editingCell.rowId, field: editingCell.field, value: newValue })
      }
    },
    [editingCell, trackPendingValue]
  )

  return { editingCell, startEditing, cancelEditing, saveEdit, autoSaveEdit, trackValue }
}


export function useInlineEditing(params: UseInlineEditingParams) {
  const { tableName, onSave, autoSave } = params
  const isAutoSave = autoSave?.saveMode === 'auto'
  const isOnBlurSave = autoSave?.saveMode === 'onBlur'

  const persistsImplicitly = isAutoSave || isOnBlurSave
  const persistence = useFieldPersistence(tableName, onSave)
  const editing = useEditingState(persistence, persistsImplicitly)

  return {
    editingCell: editing.editingCell,
    saveError: persistence.saveError,
    saveStatus: persistence.saveStatus,
    saveTarget: persistence.saveTarget,
    isAutoSave,
    isOnBlurSave,
    autoSaveDebounceMs: autoSave?.autoSaveDebounceMs ?? 500,
    startEditing: editing.startEditing,
    cancelEditing: editing.cancelEditing,
    saveEdit: editing.saveEdit,
    autoSaveEdit: editing.autoSaveEdit,
    trackPendingValue: editing.trackValue,
    flushPendingSave: persistence.flushPendingSave,
  }
}
