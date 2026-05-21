/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useState, useRef, useEffect } from 'react'
import type { FieldMeta } from '../hooks/use-inline-editing'
import type { ReactElement } from 'react'


interface EditableCellProps {
  readonly value: unknown
  readonly fieldMeta?: FieldMeta
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


function SelectEditor({
  value,
  options,
  onSave,
}: {
  readonly value: unknown
  readonly options: readonly string[]
  readonly onSave: (newValue: unknown) => void
}): ReactElement {
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    selectRef.current?.focus()
  }, [])

  return (
    <select
      ref={selectRef}
      role="combobox"
      defaultValue={String(value ?? '')}
      onChange={(e) => onSave(e.target.value)}
      className="w-full rounded border border-blue-400 px-1 py-0.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
    >
      {options.map((opt) => (
        <option
          key={opt}
          value={opt}
        >
          {opt}
        </option>
      ))}
    </select>
  )
}


function buildUpdateFormAction(tableName: string, recordId: string | number): string {
  return `/api/tables/${encodeURIComponent(String(tableName))}/records/${encodeURIComponent(String(recordId))}/update`
}

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
  })
}

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
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [tableName, recordId, fieldName])

  return { schedule, cancelTimer }
}

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
      className="w-full rounded border border-blue-400 px-1 py-0.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
    />
  )
}

function ManualSaveTextEditor(props: TextEditorProps): ReactElement {
  const { inputType, onSave, onCancel, tableName, recordId, fieldName } = props
  const { localValue, setLocalValue, inputRef, savingRef } = useTextEditorState(props.value)

  const useFormSubmit = Boolean(tableName && recordId && fieldName)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      savingRef.current = true
      if (useFormSubmit) return
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
      className="w-full rounded border border-blue-400 px-1 py-0.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
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


const SELECT_FIELD_TYPES = new Set(['single-select', 'status'])
const NUMBER_FIELD_TYPES = new Set(['integer', 'decimal', 'currency', 'percentage'])

function resolveInputType(fieldType: string): string {
  if (fieldType === 'date') return 'date'
  if (NUMBER_FIELD_TYPES.has(fieldType)) return 'number'
  return 'text'
}


function usesAutoSaveWiring(props: EditableCellProps): boolean {
  const implicitMode = props.autoSave === true || props.saveOnBlur === true
  return implicitMode && Boolean(props.onAutoSave)
}

function isSelectField(fieldMeta: FieldMeta | undefined): boolean {
  const fieldType = fieldMeta?.type ?? 'single-line-text'
  return (
    SELECT_FIELD_TYPES.has(fieldType) &&
    fieldMeta?.options !== undefined &&
    fieldMeta.options.length > 0
  )
}

export function EditableCell(props: EditableCellProps): ReactElement {
  const {
    value,
    fieldMeta,
    onSave,
    onCancel,
    tableName,
    recordId,
    fieldName,
    autoSave,
    autoSaveDebounceMs,
    saveOnBlur,
    onAutoSave,
    onTrackValue,
    onTabNext,
  } = props
  const fieldType = fieldMeta?.type ?? 'single-line-text'
  const autoSaveWiring = usesAutoSaveWiring(props)

  if (isSelectField(fieldMeta) && fieldMeta?.options) {
    return (
      <SelectEditor
        value={value}
        options={fieldMeta.options}
        onSave={autoSaveWiring && onAutoSave ? onAutoSave : onSave}
      />
    )
  }

  const TextEditorImpl = autoSaveWiring ? AutoSaveTextEditor : ManualSaveTextEditor
  return (
    <TextEditorImpl
      value={value}
      inputType={resolveInputType(fieldType)}
      onSave={onSave}
      onCancel={onCancel}
      tableName={tableName}
      recordId={recordId}
      fieldName={fieldName}
      autoSave={autoSave}
      autoSaveDebounceMs={autoSaveDebounceMs}
      saveOnBlur={saveOnBlur}
      onAutoSave={onAutoSave}
      onTrackValue={onTrackValue}
      onTabNext={onTabNext}
    />
  )
}
