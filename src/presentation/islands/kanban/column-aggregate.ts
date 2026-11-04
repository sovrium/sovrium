/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatCellValue } from '@/domain/models/app/tables/cell-value-format'
import { finiteValuesAt, reduceNumericValues } from '../runtime/numeric-aggregate'
import type { KanbanFormat } from './use-kanban-format'
import type { TableRecord } from '../runtime/types'
import type { KanbanGroupBy } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'

/** A board's `kanbanGroupBy.aggregate`: one figure per column. */
export type ColumnAggregate = NonNullable<KanbanGroupBy['aggregate']>

/**
 * The figure a column header prints, over the column's own cards, or
 * `undefined` when there is nothing honest to print.
 *
 * `count` is the number of cards whose field holds a value. `sum` reads `0`
 * over a column with no amount (a stage worth nothing is a true statement);
 * `avg`, `min` and `max` of nothing are not numbers, so they print no figure.
 * Which values are numbers is the grid summary's own rule
 * (`runtime/numeric-aggregate.ts`): a boolean, an empty multi-value cell or a
 * blank string is skipped, never read as `0` or `1`, so a column total and a
 * grid summary over the same values agree.
 */
export function aggregateColumn(
  records: readonly TableRecord[],
  aggregate: ColumnAggregate
): number | undefined {
  if (aggregate.function === 'count')
    return records.filter((record) => {
      const value = record[aggregate.field]
      return value !== undefined && value !== null && value !== ''
    }).length
  const figure = reduceNumericValues(aggregate.function, finiteValuesAt(records, aggregate.field))
  return figure === undefined && aggregate.function === 'sum' ? 0 : figure
}

/**
 * The figure as the field reads: a currency field in its own currency,
 * precision and separators (the footer's `format: currency`), a percentage
 * with its sign, any other number in the page's language. A count is a
 * number of cards, never written in the field's unit.
 */
export function formatColumnFigure(
  value: number,
  aggregate: ColumnAggregate,
  format: KanbanFormat
): string {
  if (aggregate.function === 'count') return String(value)
  const currency = format.currencyOptionsFor(aggregate.field)
  if (currency !== undefined)
    return formatCellValue(value, 'currency', format.locale, { currency, now: new Date() })
  const text = value.toLocaleString(format.locale, { maximumFractionDigits: 2 })
  return format.fieldMeta?.[aggregate.field]?.type === 'percentage' ? `${text}%` : text
}
