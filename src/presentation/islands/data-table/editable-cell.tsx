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

function TextEditor(props: TextEditorProps): ReactElement {
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


export function EditableCell({
  value,
  fieldMeta,
  onSave,
  onCancel,
  tableName,
  recordId,
  fieldName,
}: EditableCellProps): ReactElement {
  const fieldType = fieldMeta?.type ?? 'single-line-text'

  if (SELECT_FIELD_TYPES.has(fieldType) && fieldMeta?.options && fieldMeta.options.length > 0) {
    return (
      <SelectEditor
        value={value}
        options={fieldMeta.options}
        onSave={onSave}
      />
    )
  }

  return (
    <TextEditor
      value={value}
      inputType={resolveInputType(fieldType)}
      onSave={onSave}
      onCancel={onCancel}
      tableName={tableName}
      recordId={recordId}
      fieldName={fieldName}
    />
  )
}
