/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import type { SortRow } from './use-ui-state'

interface SortOverlayProps {
  readonly tableFields: readonly string[]
  readonly activeSorts: readonly SortRow[]
  readonly onAddSort: (row: Omit<SortRow, 'id'>) => void
  readonly onRemoveSort: (id: string) => void
  readonly onClearAll: () => void
  readonly onReorderSort: (id: string, toIndex: number) => void
}


interface ActiveSortChipProps {
  readonly row: SortRow
  readonly index: number
  readonly total: number
  readonly onRemove: (id: string) => void
  readonly onReorder: (id: string, toIndex: number) => void
}

function ActiveSortChip({ row, index, total, onRemove, onReorder }: ActiveSortChipProps) {
  const handleRemove = useCallback(() => onRemove(row.id), [row.id, onRemove])
  const handleMoveUp = useCallback(() => onReorder(row.id, index - 1), [row.id, index, onReorder])
  const handleMoveDown = useCallback(() => onReorder(row.id, index + 1), [row.id, index, onReorder])
  const canMoveUp = index > 0
  const canMoveDown = index < total - 1
  return (
    <span
      data-testid="sort-row"
      data-sort-priority={index + 1}
      className="bg-background-subtle border-border inline-flex items-center gap-2 rounded border px-2 py-1 text-sm"
    >
      <span className="text-foreground-muted text-xs">{index + 1}</span>
      <span>
        {row.field} {row.direction}
      </span>
      <button
        type="button"
        aria-label="Move sort up"
        title="Move up"
        disabled={!canMoveUp}
        onClick={handleMoveUp}
        className="text-foreground-muted hover:text-foreground disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Move sort down"
        title="Move down"
        disabled={!canMoveDown}
        onClick={handleMoveDown}
        className="text-foreground-muted hover:text-foreground disabled:opacity-30"
      >
        ↓
      </button>
      <button
        type="button"
        aria-label="Remove sort"
        title="Remove sort"
        onClick={handleRemove}
        className="text-foreground-muted hover:text-foreground"
      >
        ×
      </button>
    </span>
  )
}


export function SortOverlay({
  tableFields,
  activeSorts,
  onAddSort,
  onRemoveSort,
  onClearAll,
  onReorderSort,
}: SortOverlayProps) {
  const initialField = tableFields[0] ?? ''
  const [field, setField] = useState<string>(initialField)
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')

  const handleFieldChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => setField(event.target.value),
    []
  )
  const handleDirectionChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value
    if (next === 'asc' || next === 'desc') setDirection(next)
  }, [])

  const handleAddSort = useCallback(() => {
    if (field === '') return
    onAddSort({ field, direction })
  }, [field, direction, onAddSort])

  return (
    <div
      data-testid="sort-panel"
      role="dialog"
      aria-label="Sort"
      className="border-border bg-background-raised border-b p-4"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="text-foreground-muted text-sm">Sort priority (top = primary)</span>
        {activeSorts.length > 0 && (
          <button
            type="button"
            aria-label="Clear all sorts"
            onClick={onClearAll}
            className="text-foreground-muted hover:text-foreground ml-auto text-xs underline"
          >
            Clear all
          </button>
        )}
      </div>
      {activeSorts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {activeSorts.map((row, index) => (
            <ActiveSortChip
              key={row.id}
              row={row}
              index={index}
              total={activeSorts.length}
              onRemove={onRemoveSort}
              onReorder={onReorderSort}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label
          className="sr-only"
          htmlFor="sort-field"
        >
          Sort field
        </label>
        <select
          id="sort-field"
          aria-label="Sort field"
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
          htmlFor="sort-direction"
        >
          Direction
        </label>
        <select
          id="sort-direction"
          aria-label="Direction"
          value={direction}
          onChange={handleDirectionChange}
          className="border-border rounded border px-2 py-1 text-sm"
        >
          <option value="asc">asc</option>
          <option value="desc">desc</option>
        </select>
        <button
          type="button"
          onClick={handleAddSort}
          aria-label="Add sort"
          className="border-border bg-primary text-primary-foreground hover:bg-primary-hover rounded border px-3 py-1 text-sm"
        >
          Add sort
        </button>
      </div>
    </div>
  )
}
