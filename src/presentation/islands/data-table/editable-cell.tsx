/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   Cell-level editor: each cell mounts its own editor which holds local state
   and tears down on commit/cancel. Inline handlers close over draft state
   and field metadata; memoization adds code without removing re-render work
   because edits drive the very state changes that re-render the cell. */

import { useState, useRef, useEffect } from 'react'
import { optionLabel, optionValue, type SelectOptionLike } from '@/domain/utils/select-option'
import { resolveCellEditor, resolveInputType, usesSelectEditor } from './editors/editor-registry'
import type { CellEditorProps } from './editors/editor-contract'
import type { FieldMeta, FieldWriteValue } from '../hooks/use-inline-editing'
import type { ReactElement } from 'react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EditableCellProps {
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
  readonly onTabNext?: (newValue: unknown) => void
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
  readonly onTabNext?: (newValue: unknown) => void
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
      onTabNext(e.currentTarget.value)
    }
  }

  return (
    <select
      ref={selectRef}
      role="combobox"
      defaultValue={String(value ?? '')}
      onChange={(e) => onSave(e.target.value)}
      onKeyDown={handleKeyDown}
      className="border-primary focus:ring-focus-ring w-full rounded border px-1 py-0.5 text-sm focus:ring-1 focus:outline-none"
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
// Text editor (default for text, integer, date, etc.)
// ---------------------------------------------------------------------------

/**
 * Builds the form action URL for server-side inline update.
 */
function buildUpdateFormAction(tableName: string, recordId: string | number): string {
  return `/api/tables/${encodeURIComponent(String(tableName))}/records/${encodeURIComponent(String(recordId))}/update`
}

/**
 * Wraps an input in a form that POSTs to the server-side update endpoint.
 * Ensures DB write is committed before the browser navigates (server redirects via Referer).
 */
function InlineEditForm({
  tableName,
  recordId,
  children,
}: {
  readonly tableName: string
  readonly recordId: string | number
  readonly children: React.ReactNode
}): ReactElement {
  return (
    <form
      method="POST"
      action={buildUpdateFormAction(tableName, recordId)}
    >
      {children}
    </form>
  )
}

interface TextEditorProps {
  readonly value: unknown
  readonly inputType: string
  readonly onSave: (newValue: unknown) => void | Promise<void>
  readonly onCancel: () => void
  readonly tableName?: string
  readonly recordId?: string | number
  readonly fieldName?: string
  readonly autoSave?: boolean
  readonly autoSaveDebounceMs?: number
  readonly saveOnBlur?: boolean
  readonly onAutoSave?: (newValue: unknown) => void | Promise<void>
  readonly onTrackValue?: (newValue: unknown) => void
  readonly onTabNext?: (newValue: unknown) => void
}

function useTextEditorState(value: unknown) {
  const [localValue, setLocalValue] = useState(String(value ?? ''))
  const inputRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    const input = inputRef.current
    if (input) {
      input.focus()
      input.select()
    }
  }, [])

  return { localValue, setLocalValue, inputRef, savingRef }
}

/**
 * Flushes a pending auto-save edit via a keepalive fetch.
 *
 * Used when the page is about to unload (navigation, tab close): a normal
 * TanStack Query mutation would be aborted when the island unmounts, so the
 * pending value is persisted directly with `keepalive: true`, which the
 * browser allows to complete after the document is gone.
 */
function flushPendingEditViaBeacon(
  tableName: string,
  recordId: string | number,
  fieldName: string,
  value: string
): void {
  const url = `/api/tables/${encodeURIComponent(String(tableName))}/records/${encodeURIComponent(String(recordId))}`
  void fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [fieldName]: value } }),
    keepalive: true,
  }).catch(() => {
    // Best-effort flush: the document is unloading, nothing can react to failure.
  })
}

/**
 * Encapsulates the debounce timer + unload-flush bookkeeping for auto-save.
 *
 * - `schedule(value)` (re)arms the debounce timer with the latest value.
 * - `cancelTimer()` clears a pending timer when an immediate save supersedes it.
 * - A `pagehide`/`beforeunload` listener flushes any still-pending edit via a
 *   keepalive fetch so a navigation before the debounce window does not drop it.
 */
function useDebouncedAutoSave(
  props: TextEditorProps,
  debounceMs: number,
  onFire: (value: string) => void
) {
  const { tableName, recordId, fieldName } = props
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingValueRef = useRef<string | undefined>(undefined)

  const cancelTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    // eslint-disable-next-line functional/immutable-data -- Ref clear: timer no longer active
    timerRef.current = undefined
    // eslint-disable-next-line functional/immutable-data -- Ref clear: value persisted immediately
    pendingValueRef.current = undefined
  }

  const schedule = (value: string) => {
    // eslint-disable-next-line functional/immutable-data -- Ref tracks the in-progress value for unload flush
    pendingValueRef.current = value
    if (timerRef.current) clearTimeout(timerRef.current)
    // eslint-disable-next-line functional/immutable-data -- Ref holds the active debounce timer
    timerRef.current = setTimeout(() => {
      // eslint-disable-next-line functional/immutable-data -- Ref clear: timer fired
      timerRef.current = undefined
      // eslint-disable-next-line functional/immutable-data -- Ref clear: value is being persisted
      pendingValueRef.current = undefined
      onFire(value)
    }, debounceMs)
  }

  useEffect(() => {
    const flushOnHide = () => {
      if (timerRef.current === undefined) return
      const pending = pendingValueRef.current
      clearTimeout(timerRef.current)
      // eslint-disable-next-line functional/immutable-data -- Ref clear after flush
      timerRef.current = undefined
      if (pending !== undefined && tableName && recordId !== undefined && fieldName) {
        flushPendingEditViaBeacon(tableName, recordId, fieldName, pending)
      }
    }
    window.addEventListener('pagehide', flushOnHide)
    window.addEventListener('beforeunload', flushOnHide)
    return () => {
      window.removeEventListener('pagehide', flushOnHide)
      window.removeEventListener('beforeunload', flushOnHide)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [tableName, recordId, fieldName])

  return { schedule, cancelTimer }
}

/**
 * Text editor in auto-save mode: debounces edits and persists them
 * automatically without exiting edit mode (Airtable-like behavior).
 *
 * When `saveOnBlur` is set, keystrokes do NOT schedule a debounced save;
 * instead the edit is persisted when the input loses focus (Notion-like).
 */
function AutoSaveTextEditor(props: TextEditorProps): ReactElement {
  const { inputType, fieldName, autoSaveDebounceMs, saveOnBlur, onAutoSave, onTrackValue } = props
  const { localValue, setLocalValue, inputRef } = useTextEditorState(props.value)

  const fireAutoSave = (value: string) => void Promise.resolve(onAutoSave?.(value))
  const { schedule, cancelTimer } = useDebouncedAutoSave(
    props,
    autoSaveDebounceMs ?? 500,
    fireAutoSave
  )

  const handleChange = (next: string) => {
    setLocalValue(next)
    onTrackValue?.(next)
    // In onBlur mode the save fires on blur, not on every keystroke.
    if (!saveOnBlur) schedule(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        cancelTimer()
        if (saveOnBlur) fireAutoSave(localValue)
        else props.onTabNext?.(localValue)
        break
      case 'Enter':
        e.preventDefault()
        cancelTimer()
        fireAutoSave(localValue)
        break
      case 'Escape':
        e.preventDefault()
        props.onCancel()
        break
    }
  }

  const handleBlur = () => {
    if (saveOnBlur) {
      cancelTimer()
      fireAutoSave(localValue)
    }
  }

  return (
    <input
      ref={inputRef}
      type={inputType}
      name={fieldName}
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="border-primary focus:ring-focus-ring w-full rounded border px-1 py-0.5 text-sm focus:ring-1 focus:outline-none"
    />
  )
}

/**
 * Text editor in manual-save mode: persists on Enter (or native form submit
 * when wrapped in {@link InlineEditForm}) and cancels on blur/Escape.
 */
function ManualSaveTextEditor(props: TextEditorProps): ReactElement {
  const { inputType, onSave, onCancel, tableName, recordId, fieldName } = props
  const { localValue, setLocalValue, inputRef, savingRef } = useTextEditorState(props.value)

  const useFormSubmit = Boolean(tableName && recordId && fieldName)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // eslint-disable-next-line functional/immutable-data -- Ref mutation required to track save state
      savingRef.current = true
      if (useFormSubmit) return // Let form submit naturally
      e.preventDefault()
      void Promise.resolve(onSave(localValue))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const inputElement = (
    <input
      ref={inputRef}
      type={inputType}
      name={fieldName}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (!savingRef.current) onCancel()
      }}
      className="border-primary focus:ring-focus-ring w-full rounded border px-1 py-0.5 text-sm focus:ring-1 focus:outline-none"
    />
  )

  if (useFormSubmit && tableName && recordId) {
    return (
      <InlineEditForm
        tableName={tableName}
        recordId={recordId}
      >
        {inputElement}
      </InlineEditForm>
    )
  }
  return inputElement
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

/**
 * The plain-input editor, in whichever save mode this cell is wired for.
 *
 * Auto-save and manual-save are distinct components (each owns its own hooks),
 * so the choice is made here rather than inside one component that would run
 * both sets.
 */
function TextEditor(props: EditableCellProps & { readonly autoSaveWiring: boolean }): ReactElement {
  const Impl = props.autoSaveWiring ? AutoSaveTextEditor : ManualSaveTextEditor
  return (
    <Impl
      value={props.value}
      inputType={resolveInputType(props.fieldMeta?.type ?? 'single-line-text')}
      onSave={props.onSave}
      onCancel={props.onCancel}
      tableName={props.tableName}
      recordId={props.recordId}
      fieldName={props.fieldName}
      autoSave={props.autoSave}
      autoSaveDebounceMs={props.autoSaveDebounceMs}
      saveOnBlur={props.saveOnBlur}
      onAutoSave={props.onAutoSave}
      onTrackValue={props.onTrackValue}
      onTabNext={props.onTabNext}
    />
  )
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
