/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, useRef, useEffect } from 'react'
import { resolveInputType } from './editors/editor-registry'
import type { EditableCellProps } from './editable-cell'
import type { TabDirection } from './island/tab-target'
import type { MutableRefObject, ReactElement } from 'react'

/**
 * The grid's inline edit form and its text cell editor, in two save modes:
 * auto-save, debounced and flushed on unload, and manual save on Enter.
 */

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
  readonly onTabNext?: (newValue: unknown, direction: TabDirection) => void
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
    timerRef.current = undefined
    pendingValueRef.current = undefined
  }

  const schedule = (value: string) => {
    pendingValueRef.current = value
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined
      pendingValueRef.current = undefined
      onFire(value)
    }, debounceMs)
  }

  useEffect(() => {
    const flushOnHide = () => {
      if (timerRef.current === undefined) return
      const pending = pendingValueRef.current
      clearTimeout(timerRef.current)
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
      // An unmount with an edit still pending is the same loss as an unload:
      // a client-side navigation tears the grid down without unloading the
      // document, so neither listener above ever fires for it. Flushed the
      // same way, so the value the reader typed reaches the record.
      flushOnHide()
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
        else props.onTabNext?.(localValue, e.shiftKey ? 'previous' : 'next')
        break
      case 'Enter':
        e.preventDefault()
        cancelTimer()
        fireAutoSave(localValue)
        break
      case 'Escape':
        e.preventDefault()
        cancelTimer() // dropped: the unmount below must not save a cancelled edit
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
      className="border-primary focus:ring-focus-ring text-md w-full rounded border px-1 py-0.5 focus:ring-1 focus:outline-none"
    />
  )
}

/**
 * Manual-save mode's key handling, lifted out of the component so the
 * component stays a renderer.
 */
function manualSaveKeyHandler(ctx: {
  readonly props: TextEditorProps
  readonly localValue: string
  readonly savingRef: MutableRefObject<boolean>
}): (e: React.KeyboardEvent) => void {
  const { props, localValue, savingRef } = ctx
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      savingRef.current = true
      // Committed over the API, and the page is KEPT. The `<form>` around this
      // input is left for a browser with no script, which submits it natively;
      // with one, letting that submit navigate would throw away the cell
      // cursor and land the reader on `document.body`, where the next
      // keystroke scrolls the document instead of moving to the row below.
      e.preventDefault()
      void Promise.resolve(props.onSave(localValue))
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      props.onCancel()
      return
    }
    // Tab commits and moves to the neighbouring editable cell, in both
    // directions. Without it the browser walks its own DOM tab order, which
    // lands on the next cell WITHOUT opening its editor — so a reader who
    // overshot by one column could not get back without the mouse.
    if (e.key === 'Tab' && props.onTabNext) {
      e.preventDefault()
      savingRef.current = true
      props.onTabNext(localValue, e.shiftKey ? 'previous' : 'next')
    }
  }
}

/**
 * Text editor in manual-save mode: persists on Enter (or native form submit
 * when wrapped in {@link InlineEditForm}) and cancels on blur/Escape.
 */
function ManualSaveTextEditor(props: TextEditorProps): ReactElement {
  const { inputType, onCancel, tableName, recordId, fieldName } = props
  const { localValue, setLocalValue, inputRef, savingRef } = useTextEditorState(props.value)

  const useFormSubmit = Boolean(tableName && recordId && fieldName)

  const handleKeyDown = manualSaveKeyHandler({ props, localValue, savingRef })

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
      className="border-primary focus:ring-focus-ring text-md w-full rounded border px-1 py-0.5 focus:ring-1 focus:outline-none"
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

/**
 * The plain-input editor, in whichever save mode this cell is wired for.
 *
 * Auto-save and manual-save are distinct components (each owns its own hooks),
 * so the choice is made here rather than inside one component that would run
 * both sets.
 */
export function TextEditor(
  props: EditableCellProps & { readonly autoSaveWiring: boolean }
): ReactElement {
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
