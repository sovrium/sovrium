/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import {
  computeTableChipClasses,
  computeTableChipValueClasses,
  computeTablePanelCaptionClasses,
  computeTablePanelClasses,
  computeTablePanelControlClasses,
  computeTablePanelLinkClasses,
  computeTablePanelRemoveClasses,
  computeTableToolbarPrimaryButtonClasses,
} from '@/presentation/design/table-default-classes'
import type { SortRow } from './use-ui-state'

/**
 * Runtime multi-sort panel (PG-03 / [internal ref]).
 *
 * Mirrors the {@link FilterOverlay} shape (a `<div role="dialog">` with three
 * native form controls) so the visual + a11y story stays uniform across
 * runtime-view builders. Already-committed sort rows render above as chips
 * with a per-row remove button and a drag-handle (↑/↓ keyboard reorder) to
 * change priority. The first row is the primary sort key, the second is the
 * secondary, etc.
 *
 * The spec drives the controls via `selectOption()` against native
 * `<select>` elements:
 *
 * | Element                     | role      | accessible name |
 * | --------------------------- | --------- | --------------- |
 * | `<select>` field            | combobox  | "Sort field"    |
 * | `<select>` direction        | combobox  | "Direction"     |
 * | `<button>` commit           | button    | "Add sort"      |
 *
 * NOTE: the panel is purely client-side. Saved views (Cycle 5) will
 * serialise the `activeSorts` array verbatim (matches `FilterRow` shape).
 */
interface SortOverlayProps {
  readonly tableFields: readonly string[]
  readonly activeSorts: readonly SortRow[]
  readonly onAddSort: (row: Omit<SortRow, 'id'>) => void
  readonly onRemoveSort: (id: string) => void
  readonly onClearAll: () => void
  readonly onReorderSort: (id: string, toIndex: number) => void
}

// ---------------------------------------------------------------------------
// ActiveSortChip — a single committed sort row with reorder controls
// ---------------------------------------------------------------------------

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
      className={computeTableChipClasses()}
    >
      {/* The rank is a caption ON the chip — it says where this key sits in the
          order, which is information about the chip rather than part of it. */}
      <span className={computeTablePanelCaptionClasses()}>{index + 1}</span>
      <span>
        {row.field} <span className={computeTableChipValueClasses()}>{row.direction}</span>
      </span>
      <button
        type="button"
        aria-label="Move sort up"
        title="Move up"
        disabled={!canMoveUp}
        onClick={handleMoveUp}
        className={`${computeTablePanelRemoveClasses()} disabled:opacity-30`}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Move sort down"
        title="Move down"
        disabled={!canMoveDown}
        onClick={handleMoveDown}
        className={`${computeTablePanelRemoveClasses()} disabled:opacity-30`}
      >
        ↓
      </button>
      <button
        type="button"
        aria-label="Remove sort"
        title="Remove sort"
        onClick={handleRemove}
        className={computeTablePanelRemoveClasses()}
      >
        ×
      </button>
    </span>
  )
}

// ---------------------------------------------------------------------------
// SortOverlay — the panel itself
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function -- single-screen panel with 3 native form controls + chip list; further extraction would just split a single visual unit across files (mirrors FilterOverlay)
export function SortOverlay({
  tableFields,
  activeSorts,
  onAddSort,
  onRemoveSort,
  onClearAll,
  onReorderSort,
}: SortOverlayProps) {
  // Draft row state — what the user is currently authoring before clicking
  // "Add sort". The committed state lives in the parent's `activeSorts`.
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
      className={computeTablePanelClasses()}
    >
      {/* The panel is a flex COLUMN with its own gap now, so the rows no longer
          carry per-row bottom margins that had to agree with each other. */}
      <div className="flex items-center gap-3">
        <span className={computeTablePanelCaptionClasses()}>Sort priority (top = primary)</span>
        {activeSorts.length > 0 && (
          <button
            type="button"
            aria-label="Clear all sorts"
            onClick={onClearAll}
            className={`ml-auto ${computeTablePanelLinkClasses()}`}
          >
            Clear all
          </button>
        )}
      </div>
      {activeSorts.length > 0 && (
        <div className="flex flex-wrap gap-2">
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
          className={computeTablePanelControlClasses()}
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
          className={computeTablePanelControlClasses()}
        >
          <option value="asc">asc</option>
          <option value="desc">desc</option>
        </select>
        <button
          type="button"
          onClick={handleAddSort}
          aria-label="Add sort"
          // PRIMARY for the same specified reason as `Add filter`:
          // `[internal ref]` reads this control's
          // resolved pixel against the author `primary` token, so it is the
          // panel's canonical recolorable surface rather than drift from the
          // canvas' secondary commit.
          className={computeTableToolbarPrimaryButtonClasses()}
        >
          Add sort
        </button>
      </div>
    </div>
  )
}
