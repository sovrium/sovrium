/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react'
import { useFieldPersistence } from './use-field-persistence'
import type { Persistence } from './use-field-persistence'
import type { RecordButtonConfig } from '../runtime/record-button'
import type { CalendarWeekday } from '@/domain/kernel/format/calendar-date'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { DurationDisplayFormat } from '@/domain/kernel/format/duration-format'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type { SelectOptionLike } from '@/domain/models/app/tables/select-option'
import type { BadgeForm, OptionChipPaint } from '@/presentation/design/option-chip-paint'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditingCell {
  readonly rowId: string | number
  readonly field: string
  readonly value: unknown
}

// The save-status state machine moved to `use-save-status.ts`; both types are
// re-exported here because the grid, its indicator and its view all import them
// from this module.
export type { SaveStatus } from './use-save-status'

/**
 * What a single field write may carry — the client-side mirror of the
 * endpoint's `fieldValueSchema`. A `multi-select` writes an array of strings
 * and an attachment with `storeMetadata: true` writes an object, so both belong
 * here alongside the scalars.
 */
export type FieldWriteValue =
  string | number | boolean | null | readonly unknown[] | Readonly<Record<string, unknown>>

/**
 * The declared display properties a field carries, forwarded from `app.tables`
 * by `type-specific-props-builder.ts`'s allowlist.
 *
 * This struct is the fix for a single narrowing that explained most of what the
 * grid could not render: `dataTableFieldMeta` was built as exactly
 * `{ type, options?, required? }`, so `rating.max`, `rating.style`,
 * `progress.color`, `barcode.format`, `duration.displayFormat` and every
 * `currency` property were dropped before they reached the browser — which is
 * why a field declaring `currency: 'EUR'` rendered `$0.35`.
 *
 * The currency half EXTENDS `CurrencyDisplayOptions` and the duration preset
 * reuses `DurationDisplayFormat` rather than restating either. Both are the
 * types the formatters that consume this struct already accept, so a property
 * added to a formatter cannot silently fail to reach the browser.
 */
export interface FieldDisplayMeta extends CurrencyDisplayOptions {
  /** `rating` — how many glyphs the scale draws. */
  readonly max?: number
  /** `rating` — which glyph the scale draws. Selects a GLYPH, never a hue. */
  readonly style?: string
  /** `progress` — the bar fill the author declared (`#RRGGBB`). */
  readonly color?: string
  /** `barcode` — the declared symbology (`EAN-13`, `UPC-A`, …). */
  readonly format?: string
  /** `duration` — one of the three display presets. */
  readonly displayFormat?: DurationDisplayFormat
  /** `formula` — the declared result kind (`text`, `number`, `date`, …). */
  readonly resultType?: string
  /** An option field's chip form, from `design.badgeForm` — present only for `outline-dot`. */
  readonly badgeForm?: BadgeForm
  /** An option field's chip classes — the table's `chip` part, resolved server-side. */
  readonly chipClassName?: string
  /** `date` / `datetime` — the day of the week printed before the date. */
  readonly weekday?: CalendarWeekday
}

/**
 * The declared properties an EDITABLE cell's control needs.
 *
 * Sibling to {@link FieldDisplayMeta} and forwarded by the same allowlist
 * mechanism in `render/props/resolve-field-cell-meta.ts` (`EDIT_META_KEYS`). Nothing here
 * affects how a cell reads — these are the inputs an editor cannot open
 * without.
 */
export interface FieldEditMeta {
  /** `relationship` — the table the picker searches. */
  readonly relatedTable?: string
  /** `relationship` — the column the picker searches and labels rows by. */
  readonly displayField?: string
  /** `relationship` — `many-to-one` / `one-to-many`; `many-to-many` owns no column. */
  readonly relationType?: string
  /** `relationship` / `user` — whether the column holds a list of keys. */
  readonly allowMultiple?: boolean
  /**
   * `relationship` — whether the picker may create a missing related record
   * from the typed text. Declared on the FIELD; the answer to whether
   * the CURRENT CALLER may do so is {@link canCreateRelated}, and both must be
   * true for the affordance to be drawn.
   */
  readonly allowCreate?: boolean
  /** `relationship` — ceiling on how many records the column may link to. */
  readonly maxLinked?: number
  /**
   * `relationship` — whether the current session may create in `relatedTable`.
   *
   * NOT a field property, and therefore not forwarded by `EDIT_META_KEYS`: it is
   * a per-session permission answer, stamped by the data-source resolver where
   * the session role is known and merged into this bag there. Absent means auth
   * is not configured, which reads as PERMITTED — the same full-access default
   * the toolbar's own `_canCreate` gate uses.
   */
  readonly canCreateRelated?: boolean
  /** attachments — the bucket uploads are posted to. */
  readonly bucket?: string
  /**
   * `single-attachment` / `multiple-attachments` — the column-shape switch.
   * Absent means `VARCHAR(255)` and a bare storage key; `true` promotes the
   * column to `JSONB` and the cell must write the metadata object instead.
   */
  readonly storeMetadata?: boolean
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  readonly maxFiles?: number
  /** `rich-text` — the declared toolbar actions. */
  readonly toolbar?: readonly string[]
  readonly placeholder?: string
  /** `rich-text` — budget measured on the STORED HTML, as the CHECK measures it. */
  readonly maxLength?: number
  /**
   * `code` — the grammar the cell editor loads.
   *
   * The one property of the field the schema makes REQUIRED, and the one that
   * decides whether the surface is a code editor at all: without it CodeMirror
   * draws the stored source as one undifferentiated run of monospace text.
   */
  readonly language?: string
  /** `code` — draw the line-number gutter. Defaults to `true`. */
  readonly lineNumbers?: boolean
  /** `code` — indent width in spaces (1-8). Defaults to `2`. */
  readonly tabSize?: number
  /** `code` — floor on the editor's visible height, in lines. */
  readonly minLines?: number
  /** `code` — ceiling on the visible height before the surface scrolls. */
  readonly maxLines?: number
  /** `datetime` — the zone the instant is resolved into. Capital Z. */
  readonly timeZone?: string
}

export interface FieldMeta {
  readonly type: string
  /**
   * The field's external display name, forwarded from `app.tables`. Titles the
   * column header in place of the raw `name`; absent when the field declares
   * none — and always absent for `button`, whose top-level `label` is its own
   * caption and travels in {@link FieldMeta.button} instead.
   */
  readonly label?: string
  /**
   * The field's declared options, forwarded VERBATIM from `app.tables` by
   * `type-specific-props-builder.ts` — so each entry is a bare string OR a
   * `{ value, label?, color? }` object, exactly as the author wrote it.
   *
   * This was typed `readonly string[]`, which was never true: `status` options
   * have been authored as objects since long before option colour existed. The
   * type was the lie, not the data, and it let three call sites render an option
   * straight into JSX — which throws the moment an author uses the object form.
   * Normalise through `optionValue` / `optionLabel` at every render site.
   */
  readonly options?: readonly SelectOptionLike[]
  readonly required?: boolean
  /** Declared display properties — see {@link FieldDisplayMeta}. */
  readonly display?: FieldDisplayMeta
  /** Declared editor properties — see {@link FieldEditMeta}. */
  readonly edit?: FieldEditMeta
  /**
   * Button-field config, present only on `type: 'button'` fields. Carried
   * through because a button is the one field type whose CELL is an action:
   * the renderer needs its label, what it dispatches, and the `visibleWhen`
   * predicate that decides which rows show it.
   */
  readonly button?: RecordButtonConfig
  /**
   * An option field's chip paints, by value — resolved on the server for a
   * board's `badge` footer so it draws the grid's chip (`option-badge-paints.ts`).
   */
  readonly paints?: Readonly<Record<string, OptionChipPaint>>
  /**
   * The grid's reader may read this field but not write it — marked on the
   * server from her permission map (`caller-table-inputs.ts`). No surface of
   * the grid offers an input for it.
   */
  readonly readOnly?: boolean
}

export type FieldMetaMap = Readonly<Record<string, FieldMeta>>

interface UseInlineEditingParams {
  readonly tableName: string
  readonly fieldMeta?: FieldMetaMap
  readonly onSave?: () => void
  readonly autoSave?: AutoSaveConfig
}

/**
 * The enter/exit/save callbacks for inline editing, built on top of the
 * {@link useFieldPersistence} write layer.
 */
function useEditingState(persistence: Persistence, isAutoSave: boolean) {
  const { persistField, flushPendingSave, trackPendingValue } = persistence
  const [editingCell, setEditingCell] = useState<EditingCell | undefined>(undefined)

  const startEditing = useCallback(
    (rowId: string | number, field: string, currentValue: unknown) => {
      // Switching cells while an auto-save is pending: flush it first.
      if (isAutoSave) void flushPendingSave()
      setEditingCell({ rowId, field, value: currentValue })
    },
    [isAutoSave, flushPendingSave]
  )

  const cancelEditing = useCallback(() => setEditingCell(undefined), [])

  const saveEdit = useCallback(
    async (newValue: unknown) => {
      const saved = editingCell
      if (!saved) return
      try {
        await persistField(saved.rowId, saved.field, newValue)
      } finally {
        // Close the editor this save BELONGS to, never "whichever editor is
        // open now".
        //
        // The write is awaited, and the operator does not wait with it: Enter
        // already moved the cursor down (see `useCursorAwareEditHandlers`), so
        // a second Enter can open the NEXT cell's editor before the first
        // round trip returns. An unconditional `setEditingCell(undefined)`
        // here then shut that second editor and discarded whatever had been
        // typed into it — the faster the typist and the slower the link, the
        // more often. Anchoring the close on the saved cell makes it
        // idempotent, the same reason `advanceCursorRow` anchors on the row
        // being edited rather than on the live cursor.
        setEditingCell((current) =>
          current?.rowId === saved.rowId && current.field === saved.field ? undefined : current
        )
      }
    },
    [editingCell, persistField]
  )

  // Auto-save WITHOUT exiting edit mode (Airtable-like behavior).
  const autoSaveEdit = useCallback(
    async (newValue: unknown) => {
      if (editingCell) await persistField(editingCell.rowId, editingCell.field, newValue)
    },
    [editingCell, persistField]
  )

  // Records the latest un-persisted value so a cell switch can flush it.
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages inline editing state for data table cells.
 *
 * Handles entering/exiting edit mode and persisting changes via the API.
 * Uses TanStack Query useMutation for async saves with automatic
 * cache invalidation of table records.
 *
 * When an {@link AutoSaveConfig} with `saveMode: 'auto'` is supplied, edits
 * are persisted automatically (debounced) without an explicit Enter keypress,
 * and any pending save is flushed when the user moves to a different cell.
 */
export function useInlineEditing(params: UseInlineEditingParams) {
  const { tableName, onSave, autoSave } = params
  const isAutoSave = autoSave?.saveMode === 'auto'
  const isOnBlurSave = autoSave?.saveMode === 'onBlur'

  // Both 'auto' and 'onBlur' modes persist edits without an explicit Enter
  // keypress and flush pending edits when the user switches cells.
  const persistsImplicitly = isAutoSave || isOnBlurSave
  const persistence = useFieldPersistence(tableName, onSave)
  const editing = useEditingState(persistence, persistsImplicitly)

  return {
    editingCell: editing.editingCell,
    saveError: persistence.saveError,
    /**
     * Set when a save was refused because the record changed underneath it.
     * Distinct from {@link saveError}: the write did not fail, it was declined,
     * and retrying it unchanged would be declined again.
     */
    saveConflict: persistence.saveConflict,
    /** Re-issue the write that exhausted its automatic retries. */
    retryFailedSave: persistence.retryFailedSave,
    saveStatus: persistence.saveStatus,
    saveTarget: persistence.saveTarget,
    isAutoSave,
    isOnBlurSave,
    autoSaveDebounceMs: autoSave?.autoSaveDebounceMs ?? 500,
    startEditing: editing.startEditing,
    cancelEditing: editing.cancelEditing,
    /**
     * Persist one cell WITHOUT first entering edit mode.
     *
     * The single-gesture controls (`checkbox`, `rating`) commit on one click,
     * so there is no editor to open and close around the write. They cannot
     * route through `saveEdit`: that reads `editingCell` from its own closure,
     * and a `startEditing` fired in the same tick has not landed there yet — it
     * would silently drop every toggle.
     */
    commitCellValue: persistence.persistField,
    saveEdit: editing.saveEdit,
    autoSaveEdit: editing.autoSaveEdit,
    trackPendingValue: editing.trackValue,
    flushPendingSave: persistence.flushPendingSave,
  }
}
