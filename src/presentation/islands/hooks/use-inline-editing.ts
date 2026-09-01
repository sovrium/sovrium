/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, useCallback, useRef } from 'react'
import { useRowSaveQueue } from './use-row-save-queue'
import { useSaveStatusState } from './use-save-status'
import { useSaveTokens } from './use-save-tokens'
import { useUpdateRecord } from './use-table-mutations'
import type { RecordButtonConfig } from '../shared/record-button'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type { CurrencyDisplayOptions } from '@/domain/utils/currency-format'
import type { DurationDisplayFormat } from '@/domain/utils/duration-format'
import type { SelectOptionLike } from '@/domain/utils/select-option'

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
export type { SaveStatus, SaveTarget } from './use-save-status'

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
 * added to a formatter cannot silently fail to reach the browser — which is the
 * exact failure this struct exists to fix, and it would have been reintroduced
 * one level down by a hand-copied shape.
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
}

/**
 * The declared properties an EDITABLE cell's control needs.
 *
 * Sibling to {@link FieldDisplayMeta} and forwarded by the same allowlist
 * mechanism in `type-specific-props-builder.ts` (`EDIT_META_KEYS`). Nothing here
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
          // The cast used to read `string | number | boolean | null`, which was
          // narrower than what the endpoint accepts: `fieldValueSchema` also
          // admits `z.array(z.unknown())` and `z.record(...)`. Arrays and
          // objects always survived the round trip — the cast is erased — so
          // the type was not protecting anything, it was only telling the next
          // author that a multi-select or an attachment editor was impossible.
          fields: { [field]: value as FieldWriteValue },
          ...(updatedAt !== undefined && { updatedAt }),
        })
        rememberToken(rowId, response)
        // eslint-disable-next-line functional/immutable-data -- Ref clear: nothing is stranded once a save lands
        failedSaveRef.current = undefined
        markSaved()
        onSave?.()
        return true
      } catch (error) {
        // eslint-disable-next-line functional/immutable-data -- Ref holds the write the retry control re-issues
        failedSaveRef.current = { rowId, field, value }
        markFailed(error)
        return false
      }
    },
    [updateRecord, onSave, markSaved, markFailed, resolveToken, rememberToken, failedSaveRef]
  )
}

function useFieldPersistence(tableName: string, onSave?: () => void) {
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
      // eslint-disable-next-line functional/immutable-data -- Ref clear: this write supersedes any pending auto-save
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
    // eslint-disable-next-line functional/immutable-data -- Ref tracking the in-progress edit value
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

type Persistence = ReturnType<typeof useFieldPersistence>

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
      if (!editingCell) return
      try {
        await persistField(editingCell.rowId, editingCell.field, newValue)
      } finally {
        setEditingCell(undefined)
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
