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
import type { FieldMeta } from '../hooks/use-inline-editing'
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
}

// ---------------------------------------------------------------------------
// Select editor (for single-select / status fields)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Field type → input type mapping
// ---------------------------------------------------------------------------

const SELECT_FIELD_TYPES = new Set(['single-select', 'status'])
const NUMBER_FIELD_TYPES = new Set(['integer', 'decimal', 'currency', 'percentage'])

function resolveInputType(fieldType: string): string {
  if (fieldType === 'date') return 'date'
  if (NUMBER_FIELD_TYPES.has(fieldType)) return 'number'
  return 'text'
}

// ---------------------------------------------------------------------------
// Main editable cell component
// ---------------------------------------------------------------------------

/**
 * Renders a field-type-aware inline editor.
 * Select fields get a dropdown; other types get an appropriate HTML input.
 */
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
