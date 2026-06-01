/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useState } from 'react'
import { getOperatorsForType, isSelectValueField } from './filter-operators'
import type { FilterConjunction, FilterRow } from './use-ui-state'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

interface FilterOverlayProps {
  readonly tableFields: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly activeFilters: readonly FilterRow[]
  readonly filterConjunction: FilterConjunction
  readonly onAddFilter: (row: Omit<FilterRow, 'id'>) => void
  readonly onRemoveFilter: (id: string) => void
  readonly onClearAll: () => void
  readonly onToggleConjunction: () => void
}


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


export function FilterOverlay({
  tableFields,
  fieldMeta,
  activeFilters,
  filterConjunction,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
  onToggleConjunction,
}: FilterOverlayProps) {
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
        {activeFilters.length > 0 && (
          <button
            type="button"
            aria-label="Clear all filters"
            onClick={onClearAll}
            className="text-foreground-muted hover:text-foreground ml-auto text-xs underline"
          >
            Clear all
          </button>
        )}
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
              {f}
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
                  key={opt}
                  value={opt}
                >
                  {opt}
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
