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
  /** Container the paste interaction is scoped to (the data-table island root). */
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  /** Target table name for the batch create. */
  readonly tableName: string
  /** Table field names offered as column mapping targets. */
  readonly tableFields: readonly string[]
  /** Field metadata (types) used to flag type-mismatched preview cells. */
  readonly fieldMeta?: FieldMetaMap
  /** Called after a successful batch create so the table can refresh. */
  readonly onImported?: () => void
  /**
   * Whether paste-import is active. Defaults to `true`. A system-source
   * data-table (read endpoint, no DB table to write to) passes `false` so the
   * Ctrl/Cmd+V import flow is never wired.
   */
  readonly enabled?: boolean
}

/**
 * Wires Ctrl/Cmd+V paste-from-spreadsheet behaviour into the data-table.
 *
 * When the table is focused and the user presses Ctrl/Cmd+V, the clipboard's
 * TSV payload is parsed and shown in a preview dialog with a per-column
 * field-mapping `<select>`; cells incompatible with their mapped field type
 * are flagged in red. Confirming batch-creates the records and shows a toast
 * with the created count plus an Undo action; cancelling discards them.
 *
 * Returns the dialog + toast JSX to render alongside the table.
 */
export function usePasteImport({
  containerRef,
  tableName,
  tableFields,
  fieldMeta,
  onImported,
  enabled = true,
}: UsePasteImportParams) {
  const state = usePasteState({ tableName, tableFields, fieldMeta, onImported })
  usePasteListener({ containerRef, onPasteDetected: state.openWith, enabled })

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
