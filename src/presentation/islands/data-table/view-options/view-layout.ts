/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import type { DataTableInstance } from '../island/table-features'
import type { SessionGrouping } from '../island/use-ui-state'

/** The part of a listed view that shapes the grid rather than its rows. */
export interface ViewLayout {
  /** The columns the view shows, in its order. Absent: every column. */
  readonly fields?: readonly string[]
  /** The field the view groups its rows by. Absent: no grouping. */
  readonly groupBy?: { readonly field: string }
}

/** The grid state a view's layout is applied to. */
interface LayoutSetters {
  readonly setColumnVisibility: (visibility: Record<string, boolean>) => void
  readonly setColumnOrder: (order: string[]) => void
  readonly setGrouping: (grouping: SessionGrouping) => void
}

/**
 * Apply a view's `fields` and `groupBy` to the grid, or clear them for the
 * table read through no view.
 *
 * A view's rows come from the server — its filters and sorts travel with the
 * read — but which columns it shows, in what order, and what it groups by are
 * the GRID's to draw. So picking a view hides every field column it does not
 * name, puts the ones it does in its order, and groups by its field. The
 * generated columns (the selection checkbox, the action cluster) bind no field
 * and keep their places: the checkbox leads, the actions trail.
 */
export function useViewLayout(
  table: DataTableInstance,
  ui: LayoutSetters
): (view: ViewLayout | undefined) => void {
  const { setColumnVisibility, setColumnOrder, setGrouping } = ui
  return useCallback(
    (view) => {
      const columns = table.getAllLeafColumns()
      const fieldOf = (id: string): string | undefined =>
        columns.find((column) => column.id === id)?.columnDef.meta?.field
      const fields = view?.fields?.filter((field) => columns.some((c) => fieldOf(c.id) === field))
      if (fields === undefined || fields.length === 0) {
        setColumnVisibility({})
        setColumnOrder([])
      } else {
        const named = new Set(fields)
        setColumnVisibility(
          Object.fromEntries(
            columns
              .filter((column) => fieldOf(column.id) !== undefined)
              .map((column) => [column.id, named.has(fieldOf(column.id) ?? '')])
          )
        )
        const leading = columns
          .slice(
            0,
            Math.max(
              0,
              columns.findIndex((column) => fieldOf(column.id) !== undefined)
            )
          )
          .map((column) => column.id)
        const ordered = fields.flatMap((field) =>
          columns.filter((column) => fieldOf(column.id) === field).map((column) => column.id)
        )
        const rest = columns
          .map((column) => column.id)
          .filter((id) => !leading.includes(id) && !ordered.includes(id))
        setColumnOrder([...leading, ...ordered, ...rest])
      }
      setGrouping(view?.groupBy === undefined ? {} : { field: view.groupBy.field })
    },
    [table, setColumnVisibility, setColumnOrder, setGrouping]
  )
}
