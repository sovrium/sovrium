/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useRef } from 'react'
import { useRowSaveQueue } from './use-row-save-queue'
import { useSaveStatusState } from './use-save-status'
import { useSaveTokens } from './use-save-tokens'
import { useUpdateRecord } from './use-table-mutations'
import type { FieldWriteValue } from './use-inline-editing'

/**
 * How an inline edit reaches the server: the write of one field, the
 * deferred save a debounced editor holds, and the per-row queue and status
 * they report through.
 */

interface PendingSave {
  readonly rowId: string | number
  readonly field: string
  readonly value: unknown
}

// ---------------------------------------------------------------------------
// Persistence helper hook
// ---------------------------------------------------------------------------

/** A save slot: the write not yet sent, or the one that failed. */
type SaveSlot = { current: PendingSave | undefined }

/**
 * Re-issuing a write the editing UI has already moved on from: the one left
 * pending when the user tabs to another cell, and the one that failed and is
 * waiting behind a retry control. Both are the same shape — read a slot, and
 * if it holds anything, persist it — and neither needs to know how a save is
 * performed beyond `persistField`.
 */
function useDeferredSaveControls(
  persistField: (rowId: string | number, field: string, value: unknown) => Promise<boolean>,
  pendingSaveRef: SaveSlot,
  failedSaveRef: SaveSlot
) {
  const retryFailedSave = useCallback(async () => {
    const failed = failedSaveRef.current
    if (!failed) return
    await persistField(failed.rowId, failed.field, failed.value)
  }, [persistField, failedSaveRef])

  const flushPendingSave = useCallback(async () => {
    const pending = pendingSaveRef.current
    if (!pending) return
    await persistField(pending.rowId, pending.field, pending.value)
  }, [persistField, pendingSaveRef])

  return { retryFailedSave, flushPendingSave }
}

/**
 * Encapsulates the server-write side of inline editing: persists a single
 * field change, tracks the latest un-persisted value, exposes a save-error
 * message, drives the save-status state machine for the indicator, and can
 * flush a pending auto-save when the user switches cells.
 *
 * Two properties beyond "issue a PATCH" belong here rather than at the call
 * sites, because both concern a save the user is no longer watching:
 *
 *   - A transient failure is retried on a growing delay, and only once the
 *     budget is spent does the error become the user's problem — with the
 *     failed write kept so a retry control can re-issue it. Without that, an
 *     edit lost to a momentary blip was lost outright.
 *   - Every save declares the record version it was written against, so the
 *     server can refuse one made over someone else's concurrent change instead
 *     of accepting it and destroying that change. Writes to one row are queued
 *     for that declaration to mean anything — see `use-row-save-queue.ts`.
 */
interface FieldWriterParams {
  readonly tableName: string
  readonly markSaved: () => void
  readonly markFailed: (error: unknown) => void
  /** Holds the write a retry control would re-issue; cleared once one lands. */
  readonly failedSaveRef: SaveSlot
  readonly onSave?: (() => void) | undefined
}

/**
 * The write itself, performed once the row's queue has reached it.
 *
 * Separate from the queueing and the status bookkeeping around it so that each
 * of the three can be read on its own; this one is the only part that talks to
 * the server.
 */
function useFieldWriter(params: FieldWriterParams) {
  const { tableName, markSaved, markFailed, failedSaveRef, onSave } = params
  const { resolveToken, rememberToken } = useSaveTokens(tableName)
  const updateRecord = useUpdateRecord(tableName, { retryTransientFailures: true })

  return useCallback(
    async (rowId: string | number, field: string, value: unknown): Promise<boolean> => {
      // Resolved HERE rather than when the save was requested: by the time the
      // row's queue reaches this write, its predecessor has landed and taught
      // us the version it produced.
      const updatedAt = resolveToken(rowId)
      try {
        const response = await updateRecord.mutateAsync({
          recordId: String(rowId),
          // `FieldWriteValue` is the endpoint's full value shape, arrays and
          // objects included, so a multi-select or an attachment editor writes
          // through the same call as a scalar one.
          fields: { [field]: value as FieldWriteValue },
          ...(updatedAt !== undefined && { updatedAt }),
        })
        rememberToken(rowId, response)
        failedSaveRef.current = undefined
        markSaved()
        onSave?.()
        return true
      } catch (error) {
        failedSaveRef.current = { rowId, field, value }
        markFailed(error)
        return false
      }
    },
    [updateRecord, onSave, markSaved, markFailed, resolveToken, rememberToken, failedSaveRef]
  )
}

export function useFieldPersistence(tableName: string, onSave?: () => void) {
  const status = useSaveStatusState()
  const { markSaving, markSaved, markFailed } = status
  const enqueueRowSave = useRowSaveQueue()

  // The latest un-persisted value for the cell currently being edited.
  const pendingSaveRef = useRef<PendingSave | undefined>(undefined)
  // The write that exhausted its retries, kept so the retry control re-fires
  // exactly what failed rather than whatever the cell happens to hold now.
  const failedSaveRef = useRef<PendingSave | undefined>(undefined)

  const writeField = useFieldWriter({
    tableName,
    markSaved,
    markFailed,
    failedSaveRef,
    onSave,
  })

  const persistField = useCallback(
    async (rowId: string | number, field: string, value: unknown): Promise<boolean> => {
      pendingSaveRef.current = undefined
      markSaving({ rowId, field })
      // Queued behind any save still in flight for this row. Tabbing quickly
      // across a row starts the next save before the previous has answered, and
      // two concurrent writes would both declare the version they read at the
      // same instant — so the first would land and the second would be refused
      // as stale, the row conflicting with itself.
      return enqueueRowSave(rowId, () => writeField(rowId, field, value))
    },
    [markSaving, enqueueRowSave, writeField]
  )

  const deferred = useDeferredSaveControls(persistField, pendingSaveRef, failedSaveRef)

  const trackPendingValue = useCallback((pending: PendingSave) => {
    pendingSaveRef.current = pending
  }, [])

  return {
    saveError: status.saveError,
    saveConflict: status.saveConflict,
    saveStatus: status.saveStatus,
    saveTarget: status.saveTarget,
    persistField,
    trackPendingValue,
    ...deferred,
  }
}

// ---------------------------------------------------------------------------
// Editing-state helper hook
// ---------------------------------------------------------------------------

export type Persistence = ReturnType<typeof useFieldPersistence>
