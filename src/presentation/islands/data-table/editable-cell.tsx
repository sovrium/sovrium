/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRef, useEffect } from 'react'
import {
  optionLabel,
  optionValue,
  type SelectOptionLike,
} from '@/domain/models/app/tables/select-option'
import { resolveCellEditor, usesSelectEditor } from './editors/editor-registry'
import { TextEditor } from './text-cell-editor'
import type { CellEditorProps } from './editors/editor-contract'
import type { TabDirection } from './island/tab-target'
import type { FieldMeta, FieldWriteValue } from '../hooks/use-inline-editing'
import type { ReactElement } from 'react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditableCellProps {
  readonly value: unknown
  readonly fieldMeta?: FieldMeta
  readonly onSave: (newValue: unknown) => void | Promise<void>
  readonly onCancel: () => void
  readonly tableName?: string
  readonly recordId?: string | number
  readonly fieldName?: string
  /** When true, edits persist automatically (debounced) without an Enter keypress. */
  readonly autoSave?: boolean
  /** Debounce delay (ms) for auto-save. Only used when `autoSave` is true. */
  readonly autoSaveDebounceMs?: number
  /**
   * When true, edits persist when the field loses focus (Notion-like) instead
   * of on every debounced keystroke. Used by `saveMode: 'onBlur'`.
   */
  readonly saveOnBlur?: boolean
  /** Persists the in-progress edit without exiting edit mode (auto-save). */
  readonly onAutoSave?: (newValue: unknown) => void | Promise<void>
  /** Records the latest un-persisted value so a cell switch can flush it. */
  readonly onTrackValue?: (newValue: unknown) => void
  /** Saves the current value and moves the editor to the next editable cell. */
  readonly onTabNext?: (newValue: unknown, direction: TabDirection) => void
}

// ---------------------------------------------------------------------------
// Select editor (for single-select / status fields)
// ---------------------------------------------------------------------------

/**
 * The `single-select` / `status` editor.
 *
 * It had NO `onKeyDown` at all until the cell-editor work: Escape fell through
 * to the browser and Tab did native focus movement, walking out of the grid
 * instead of committing and advancing to the next editable column. That gap
 * predates every editor added around it, so it is fixed here first — the new
 * editors inherit the behaviour from `EditorPopover` rather than each
 * re-deciding it.
 */
function SelectEditor({
  value,
  options,
  onSave,
  onCancel,
  onTabNext,
}: {
  readonly value: unknown
  readonly options: readonly SelectOptionLike[]
  readonly onSave: (newValue: unknown) => void
  readonly onCancel: () => void
  readonly onTabNext?: (newValue: unknown, direction: TabDirection) => void
}): ReactElement {
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    selectRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    if (e.key === 'Tab' && onTabNext) {
      e.preventDefault()
      onTabNext(e.currentTarget.value, e.shiftKey ? 'previous' : 'next')
    }
  }

  return (
    <select
      ref={selectRef}
      role="combobox"
      defaultValue={String(value ?? '')}
      onChange={(e) => onSave(e.target.value)}
      onKeyDown={handleKeyDown}
      className="select-compact border-primary focus:ring-focus-ring text-md w-full rounded border px-1 py-0.5 focus:ring-1 focus:outline-none"
    >
      {options.map((opt) => (
        <option
          key={optionValue(opt)}
          value={optionValue(opt)}
        >
          {optionLabel(opt)}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Main editable cell component
// ---------------------------------------------------------------------------

/**
 * Whether edits should persist via the auto-save wiring (`onAutoSave` persists
 * without exiting edit mode). True for both `saveMode: 'auto'` (debounced) and
 * `saveMode: 'onBlur'` (persist on focus loss).
 */
function usesAutoSaveWiring(props: EditableCellProps): boolean {
  const implicitMode = props.autoSave === true || props.saveOnBlur === true
  return implicitMode && Boolean(props.onAutoSave)
}

/** Whether the field renders as a select dropdown (single-select / status). */
function isSelectField(fieldMeta: FieldMeta | undefined): boolean {
  const fieldType = fieldMeta?.type ?? 'single-line-text'
  return (
    usesSelectEditor(fieldType) && fieldMeta?.options !== undefined && fieldMeta.options.length > 0
  )
}

/**
 * Renders a field-type-aware inline editor.
 *
 * The editor is chosen by the field type's WIDGET, resolved through the shared
 * `field-type-behavior.ts` table that the CRUD form's two views already use.
 * This file used to decide for itself, from three local constants, and eight
 * field types fell through them to a plain text box. See `editors/editor-registry.tsx`.
 */
/**
 * Translate this cell's editing wiring into the one shape every bespoke editor
 * accepts. Extracted so the dispatch below reads as a dispatch.
 */
function toCellEditorProps(
  props: EditableCellProps,
  commit: (next: FieldWriteValue) => void | Promise<void>
): CellEditorProps {
  const { value, fieldMeta, onCancel, tableName, recordId, fieldName, onTabNext } = props
  return {
    value,
    commit: (next) => void Promise.resolve(commit(next)),
    cancel: onCancel,
    ...(onTabNext && { tabNext: onTabNext }),
    ...(fieldMeta && { fieldMeta }),
    ...(fieldName && { fieldName }),
    ...(tableName && { tableName }),
    ...(recordId !== undefined && { recordId }),
  }
}

export function EditableCell(props: EditableCellProps): ReactElement {
  const { value, fieldMeta, onSave, onCancel, onAutoSave, onTabNext } = props
  const fieldType = fieldMeta?.type ?? 'single-line-text'
  const autoSaveWiring = usesAutoSaveWiring(props)
  const commit = autoSaveWiring && onAutoSave ? onAutoSave : onSave

  // Field types with a control of their own — a set, a searched key, an
  // instant, a document, an upload — dispatch through the shared widget table.
  const BespokeEditor = resolveCellEditor(fieldType)
  if (BespokeEditor) return <BespokeEditor {...toCellEditorProps(props, commit)} />

  if (isSelectField(fieldMeta) && fieldMeta?.options) {
    // Select edits commit immediately on change; with auto-save wiring they
    // persist without exiting, otherwise they save-and-close.
    return (
      <SelectEditor
        value={value}
        options={fieldMeta.options}
        onSave={commit}
        onCancel={onCancel}
        {...(onTabNext && { onTabNext })}
      />
    )
  }

  return (
    <TextEditor
      {...props}
      autoSaveWiring={autoSaveWiring}
    />
  )
}
