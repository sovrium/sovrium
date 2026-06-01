/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../shared/types'
import type {
  DataTableSummaryItem,
  SummaryFunction,
} from '@/domain/models/app/pages/components/data-table'
import type { ReactElement } from 'react'

function computeAggregate(
  records: readonly TableRecord[],
  field: string,
  fn: SummaryFunction
): number {
  if (fn === 'count') return records.length

  const values = records.map((r) => Number(r[field])).filter((v) => !Number.isNaN(v))

  if (values.length === 0) return 0

  switch (fn) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
  }
}

export function TableSummaryFooter({
  summary,
  records,
  cellClass,
}: {
  readonly summary: readonly DataTableSummaryItem[]
  readonly records: readonly TableRecord[]
  readonly cellClass: string
}): ReactElement {
  return (
    <tfoot data-summary="true">
      <tr
        role="row"
        className="bg-background-subtle font-medium"
      >
        {summary.map((item, i) => {
          const value = computeAggregate(records, item.field, item.function)
          return (
            <td
              key={`summary-${String(i)}`}
              className={`${cellClass} text-foreground whitespace-nowrap`}
            >
              {item.label ? `${item.label}: ` : ''}
              {value}
            </td>
          )
        })}
      </tr>
    </tfoot>
  )
}
