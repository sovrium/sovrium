/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { resolveEditableFields, resolveSaveIndicator } from '../island-setup-helpers'
import { resolveTabTarget } from '../tab-target'
import type { SetupContext } from './setup-params'
import type { GridRecords } from './use-grid-table'
import type { useInlineEditing } from '../../../hooks/use-inline-editing'
import type { InlineAutoSave } from '../../body'

export type InlineSaveWiring = ReturnType<typeof useInlineSaveWiring>

/**
 * The auto-save wiring handed to the table body, plus the resolved
 * save-indicator settings.
 *
 * Both 'auto' (debounced keystroke) and 'onBlur' (save on focus loss) modes
 * share the same persistence wiring; the editor decides when to fire. Tab
 * navigation saves the current cell, then opens an editor on the next editable
 * column.
 */
export function useInlineSaveWiring(
  ctx: SetupContext,
  inlineEditing: ReturnType<typeof useInlineEditing>,
  grid: GridRecords
) {
  const { columnConfig, autoSaveConfig } = ctx.params
  const editableFields = useMemo(() => resolveEditableFields(columnConfig), [columnConfig])
  const records = grid.rows

  // Built for EVERY save mode, not only the implicit ones.
  //
  // This used to be `undefined` under manual save, and `onTabNext` rode inside
  // it — so Tab inside an editor did nothing at all on the commonest
  // configuration there is: a grid with editable columns and no `autoSave`
  // block. `enabled` and `saveOnBlur` still decide which editor renders, so a
  // manual-save grid commits on Enter exactly as it did; it simply also
  // answers Tab now.
  const inlineAutoSave: InlineAutoSave = {
    enabled: inlineEditing.isAutoSave,
    saveOnBlur: inlineEditing.isOnBlurSave,
    debounceMs: inlineEditing.autoSaveDebounceMs,
    onAutoSave: inlineEditing.autoSaveEdit,
    onTrackValue: inlineEditing.trackPendingValue,
    onTabNext: (rowId, currentField, newValue, direction) => {
      const target = resolveTabTarget({
        rowIds: records.map((record) => String(record.id)),
        editableFields,
        from: { rowId: String(rowId), field: currentField },
        direction,
      })
      // Persisted with `commitCellValue`, not through the edit-mode save: that
      // one reads the editing cell out of its own closure, and the
      // `startEditing` below fires in the same tick — so the write would be
      // attributed to the cell Tab has just moved TO.
      const committed = Promise.resolve(
        inlineEditing.commitCellValue(rowId, currentField, newValue)
      )
      // No target means Tab is leaving the grid at one of its own edges. The
      // value is still committed; focus goes wherever the browser was taking it.
      if (target === undefined) return
      void committed.then(() => {
        const record = records.find((candidate) => String(candidate.id) === target.rowId)
        inlineEditing.startEditing(target.rowId, target.field, record?.[target.field])
      })
    },
  }

  return { inlineAutoSave, saveIndicator: resolveSaveIndicator(autoSaveConfig) }
}
