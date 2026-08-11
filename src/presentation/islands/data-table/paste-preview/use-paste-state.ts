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
  /** Target table name for the batch create. */
  readonly tableName: string
  /** Table field names offered as column mapping targets. */
  readonly tableFields: readonly string[]
  /** Field metadata (types) used to drop type-mismatched cells on import. */
  readonly fieldMeta?: FieldMetaMap
  /** Called after a successful batch create so the table can refresh. */
  readonly onImported?: () => void
}

/**
 * Owns the paste-preview dialog's reactive state: the input state (parsed
 * payload + mappings, via {@link usePasteInputState}), the in-flight flag, and
 * the post-import toast (via {@link usePasteToast}).
 *
 * Lives in a `.ts` module (no JSX) so `useCallback` here is exempt from the
 * island JSX lint rules. The handlers are stable so the dialog presenter does
 * not re-allocate them per render.
 */
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
