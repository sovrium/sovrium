/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { undoPastedRecords } from './paste-records'

/** Reactive state for the post-paste confirmation toast. */
export interface PasteToastState {
  /** Number of records created by the most recent paste. */
  readonly created: number
  /** Ids of the created records, used to power Undo. */
  readonly recordIds: readonly string[]
}

interface UsePasteToastParams {
  /** Target table name used by the Undo batch-delete. */
  readonly tableName: string
  /** Called after Undo deletes the records so the table can refresh. */
  readonly onImported?: () => void
}

/**
 * Owns the post-paste confirmation toast: the created-record count, the ids
 * needed for Undo, and the in-flight Undo flag.
 *
 * Lives in a `.ts` module (no JSX) so `useCallback` here is exempt from the
 * island JSX lint rules.
 */
export function usePasteToast({ tableName, onImported }: UsePasteToastParams) {
  const [toast, setToast] = useState<PasteToastState | undefined>(undefined)
  const [isUndoing, setIsUndoing] = useState(false)

  const show = useCallback((next: PasteToastState) => setToast(next), [])
  const dismiss = useCallback(() => setToast(undefined), [])

  const onUndo = useCallback(() => {
    void (async () => {
      if (!toast) return
      setIsUndoing(true)
      try {
        await undoPastedRecords(tableName, toast.recordIds)
        onImported?.()
        setToast(undefined)
      } finally {
        setIsUndoing(false)
      }
    })()
  }, [toast, tableName, onImported])

  return { toast, isUndoing, show, dismiss, onUndo }
}
