/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { optionLabel, optionValue } from '@/domain/utils/select-option'
import { getOperatorsForType, isSelectValueField } from './filter-operators'
import type { FilterConjunction, FilterRow } from './use-ui-state'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

/**
 * Runtime filter-builder panel (PG-03 / [internal ref]..007).
 *
 * Renders three native `<select>` / `<input>` controls (field / operator /
 * value) for authoring a single filter row, plus an "Add filter" commit
 * button. Already-committed rows render above as chips with a per-row
 * remove button (`× remove filter`). A header-level AND/OR toggle flips
 * the conjunction; a footer-level "Clear all" wipes every committed row.
 *
 * The spec drives the controls via `selectOption()` + `fill()` against
 * native `<select>` / `<input type="text">`, so all three controls MUST
 * be native form elements (not Base UI Select). The accessibility roles
 * fall out of the native element + `aria-label`:
 *
 * | Element                  | role      | accessible name |
 * | ------------------------ | --------- | --------------- |
 * | `<select>` field         | combobox  | "Field"         |
 * | `<select>` operator      | combobox  | "Operator"      |
 * | `<select>` value (enum)  | combobox  | "Value"         |
 * | `<input>` value (free)   | textbox   | "Value"         |
 *
 * NOTE: the panel is purely client-side. Saved views (Cycle 5) will
 * serialise the `activeFilters` + `filterConjunction` state verbatim.
 */
interface FilterOverlayProps {
  readonly tableFields: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly activeFilters: readonly FilterRow[]
  readonly filterConjunction: FilterConjunction
  readonly onAddFilter: (row: Omit<FilterRow, 'id'>) => void
  readonly onRemoveFilter: (id: string) => void
  readonly onClearAll: () => void
  readonly onToggleConjunction: () => void
  readonly onClose: () => void
}

// ---------------------------------------------------------------------------
// ActiveFilterChip — a single committed filter row
// ---------------------------------------------------------------------------

interface ActiveFilterChipProps {
  readonly row: FilterRow
  readonly onRemove: (id: string) => void
}

function ActiveFilterChip({ row, onRemove }: ActiveFilterChipProps) {
  const handleClick = useCallback(() => onRemove(row.id), [row.id, onRemove])
  return (
    <span
      data-testid="filter-row"
      className="bg-background-subtle border-border inline-flex items-center gap-2 rounded border px-2 py-1 text-sm"
    >
      <span>
        {row.field} {row.operator} {row.value}
      </span>
      <button
        type="button"
        aria-label="Remove filter"
        title="Remove filter"
        onClick={handleClick}
        className="text-foreground-muted hover:text-foreground"
      >
        ×
      </button>
    </span>
  )
}

// ---------------------------------------------------------------------------
// FilterOverlay — the panel itself
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function, complexity -- single-screen panel with 4 native form controls + chip list; further extraction would just split a single visual unit across files
export function FilterOverlay({
  tableFields,
  fieldMeta,
  activeFilters,
  filterConjunction,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
  onToggleConjunction,
  onClose,
}: FilterOverlayProps) {
  // Escape closes the panel. The toolbar's Filter button only ever OPENS it
  // (`onOpenFilterOverlay`), and the panel is an inline disclosure rather than a
  // modal, so without this — and without the header Close button below — an
  // operator who opened it had no way to dismiss it and it sat over the results.
  // `onCloseFilterOverlay` already existed in `use-ui-state` but nothing consumed it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Draft row state — what the user is currently authoring before clicking
  // "Add filter". The committed state lives in the parent's `activeFilters`.
  const initialField = tableFields[0] ?? ''
  const [field, setField] = useState<string>(initialField)
  const initialOps = getOperatorsForType(fieldMeta?.[initialField]?.type)
  const initialOp = initialOps[0]?.value ?? 'is'
  const [operator, setOperator] = useState<string>(initialOp)
  const [value, setValue] = useState<string>('')

  const fieldType = fieldMeta?.[field]?.type
  const operators = useMemo(() => getOperatorsForType(fieldType), [fieldType])
  const fieldOptions = fieldMeta?.[field]?.options
  const renderValueAsSelect = isSelectValueField(fieldType) && Array.isArray(fieldOptions)

  const handleFieldChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newField = event.target.value
      setField(newField)
      // Re-default the operator + value when the field type changes so the
      // panel never carries a number-only operator into a text field.
      const newOps = getOperatorsForType(fieldMeta?.[newField]?.type)
      setOperator(newOps[0]?.value ?? 'is')
      setValue('')
    },
    [fieldMeta]
  )
  const handleOperatorChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => setOperator(event.target.value),
    []
  )
  const handleValueSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => setValue(event.target.value),
    []
  )
  const handleValueInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
    []
  )

  const handleAddFilter = useCallback(() => {
    if (field === '' || operator === '' || value === '') return
    onAddFilter({ field, operator, value })
    setValue('')
  }, [field, operator, value, onAddFilter])

  return (
    <div
      data-testid="filter-panel"
      role="dialog"
      aria-label="Filter"
      className="border-border bg-background-raised border-b p-4"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="text-foreground-muted text-sm">Combine filters with</span>
        <button
          type="button"
          onClick={onToggleConjunction}
          aria-label={filterConjunction === 'AND' ? 'AND' : 'OR'}
          className="border-border hover:bg-background-subtle rounded border px-2 py-1 text-xs font-medium"
        >
          {filterConjunction}
        </button>
        <div className="ml-auto flex items-center gap-3">
          {activeFilters.length > 0 && (
            <button
              type="button"
              aria-label="Clear all filters"
              onClick={onClearAll}
              className="text-foreground-muted hover:text-foreground text-xs underline"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            aria-label="Close filter panel"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground text-xs underline"
          >
            Close
          </button>
        </div>
      </div>
      {activeFilters.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {activeFilters.map((row) => (
            <ActiveFilterChip
              key={row.id}
              row={row}
              onRemove={onRemoveFilter}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label
          className="sr-only"
          htmlFor="filter-field"
        >
          Field
        </label>
        <select
          id="filter-field"
          aria-label="Field"
          value={field}
          onChange={handleFieldChange}
          className="border-border rounded border px-2 py-1 text-sm"
        >
          {tableFields.map((f) => (
            <option
              key={f}
              value={f}
            >
              {/* The declared display name, falling back to the raw field name.
                  The column header already shows the label, so naming the field
                  differently here would ask the operator to translate between
                  the two halves of the same grid. */}
              {fieldMeta?.[f]?.label ?? f}
            </option>
          ))}
        </select>
        <label
          className="sr-only"
          htmlFor="filter-operator"
        >
          Operator
        </label>
        <select
          id="filter-operator"
          aria-label="Operator"
          value={operator}
          onChange={handleOperatorChange}
          className="border-border rounded border px-2 py-1 text-sm"
        >
          {operators.map((op) => (
            <option
              key={op.value}
              value={op.value}
            >
              {op.label}
            </option>
          ))}
        </select>
        {renderValueAsSelect ? (
          <>
            <label
              className="sr-only"
              htmlFor="filter-value-select"
            >
              Value
            </label>
            <select
              id="filter-value-select"
              aria-label="Value"
              value={value}
              onChange={handleValueSelectChange}
              className="border-border rounded border px-2 py-1 text-sm"
            >
              <option value="">Select…</option>
              {fieldOptions?.map((opt) => (
                <option
                  key={optionValue(opt)}
                  value={optionValue(opt)}
                >
                  {optionLabel(opt)}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label
              className="sr-only"
              htmlFor="filter-value-text"
            >
              Value
            </label>
            <input
              id="filter-value-text"
              type="text"
              aria-label="Value"
              value={value}
              onChange={handleValueInputChange}
              placeholder="Value"
              className="border-border rounded border px-2 py-1 text-sm"
            />
          </>
        )}
        <button
          type="button"
          onClick={handleAddFilter}
          aria-label="Add filter"
          className="border-border bg-primary text-primary-foreground hover:bg-primary-hover rounded border px-3 py-1 text-sm"
        >
          Add filter
        </button>
      </div>
    </div>
  )
}
