/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { undoPastedRecords } from './paste-records'

export interface PasteToastState {
  readonly created: number
  readonly recordIds: readonly string[]
}

interface UsePasteToastParams {
  readonly tableName: string
  readonly onImported?: () => void
}

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
