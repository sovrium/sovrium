/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PastePreviewDialog } from './paste-preview-dialog'
import { PasteToast } from './paste-toast'
import { usePasteListener } from './use-paste-listener'
import { usePasteState } from './use-paste-state'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

interface UsePasteImportParams {
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  readonly tableName: string
  readonly tableFields: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly onImported?: () => void
}

export function usePasteImport({
  containerRef,
  tableName,
  tableFields,
  fieldMeta,
  onImported,
}: UsePasteImportParams) {
  const state = usePasteState({ tableName, tableFields, fieldMeta, onImported })
  usePasteListener({ containerRef, onPasteDetected: state.openWith })

  const dialog = state.parsed ? (
    <PastePreviewDialog
      parsed={state.parsed}
      mappings={state.mappings}
      tableFields={tableFields}
      fieldMeta={fieldMeta}
      isPasting={state.isPasting}
      onMappingChange={state.onMappingChange}
      onPaste={state.onPaste}
      onCancel={state.close}
    />
  ) : undefined

  const toast = state.toast ? (
    <PasteToast
      created={state.toast.created}
      isUndoing={state.isUndoing}
      onUndo={state.onUndo}
    />
  ) : undefined

  return { dialog, toast }
}
