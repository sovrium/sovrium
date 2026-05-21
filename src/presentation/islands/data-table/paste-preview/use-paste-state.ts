/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { batchCreatePastedRecords, buildRecords } from './paste-records'
import { usePasteInputState } from './use-paste-input-state'
import { usePasteToast } from './use-paste-toast'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

interface UsePasteStateParams {
  readonly tableName: string
  readonly tableFields: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly onImported?: () => void
}

export function usePasteState({
  tableName,
  tableFields,
  fieldMeta,
  onImported,
}: UsePasteStateParams) {
  const input = usePasteInputState(tableFields)
  const toastState = usePasteToast({ tableName, onImported })
  const [isPasting, setIsPasting] = useState(false)

  const onPaste = useCallback(() => {
    void (async () => {
      if (!input.parsed) return
      const records = buildRecords(input.parsed, input.mappings, fieldMeta)
      setIsPasting(true)
      try {
        const result = await batchCreatePastedRecords(tableName, records)
        onImported?.()
        input.close()
        toastState.show({ created: result.created, recordIds: result.recordIds })
      } finally {
        setIsPasting(false)
      }
    })()
  }, [input, fieldMeta, tableName, onImported, toastState])

  return {
    parsed: input.parsed,
    mappings: input.mappings,
    isPasting,
    toast: toastState.toast,
    isUndoing: toastState.isUndoing,
    openWith: input.openWith,
    close: input.close,
    onMappingChange: input.onMappingChange,
    onPaste,
    onUndo: toastState.onUndo,
    dismissToast: toastState.dismiss,
  }
}
