/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isMissing } from '../cell-empty'
import { CellCopy } from './cell-copy'
import type { DataTableCellContext } from '../island/table-features'
import type { FieldColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ReactNode } from 'react'

type CellRenderer = (context: DataTableCellContext) => ReactNode

/**
 * A field column's cell with what its column adds around the value: the copy
 * button (`copyLabel`) beside it, and the second field of the same row
 * (`secondaryField`) as a muted line under it. Render-only: the column still
 * sorts, filters, edits and exports by its own field. A row the reader may not
 * read that field of carries no value for it, so the line is simply not drawn.
 */
export function withCellExtras(render: CellRenderer, col: FieldColumn): CellRenderer {
  const { copyLabel, secondaryField } = col
  if (copyLabel === undefined && secondaryField === undefined) return render
  return (context) => {
    const value = context.getValue()
    const second = secondaryField === undefined ? undefined : context.row.original[secondaryField]
    const line = render(context)
    const head =
      copyLabel === undefined || isMissing(value) ? (
        line
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate">{line}</span>
          <CellCopy
            value={String(value)}
            label={copyLabel}
          />
        </span>
      )
    if (isMissing(second) || String(second) === '') return head
    return (
      <span className="flex min-w-0 flex-col">
        <span>{head}</span>
        <span
          className="text-muted-foreground text-xs"
          data-testid="cell-caption"
        >
          {String(second)}
        </span>
      </span>
    )
  }
}
