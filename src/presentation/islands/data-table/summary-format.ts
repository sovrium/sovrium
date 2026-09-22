/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a declared summary's number is turned into text.
 *
 * Extracted so the **footer** and the **per-group row** cannot disagree. They
 * render the same declaration (`summary[]`) over two different scopes — the view
 * and one group — and the only thing that legitimately differs between them is
 * WHICH aggregations block they read. Everything downstream of that (the column
 * lookup, the currency options, the count exemption, the pending placeholder) is
 * one rule, so it lives in one place.
 *
 * This is the shape a fork takes in this codebase: a second `resolveCurrencyOptions`
 * once let a cell and the total beneath it disagree about a currency symbol.
 */

import { formatCellValue } from '@/domain/models/app/tables/cell-value-format'
import { resolveCurrencyOptions } from './formatting'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type {
  DataTableColumn,
  DataTableSummaryItem,
  FieldColumn,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** Shown for a summary whose value has not arrived, or which the server did not compute. */
export const PENDING_VALUE = '—'

/** Everything a summary value needs to render in its own column's format. */
export interface SummaryFormatContext {
  readonly columns?: readonly DataTableColumn[]
  readonly fieldMeta?: FieldMetaMap
  readonly locale: string
}

/**
 * Render one summary's value in the format its own column declares.
 *
 * `count` is deliberately excluded from column formatting: a count is a
 * cardinality, not a value drawn from the column's unit — rendering "7 orders"
 * as `$7.00` would be worse than not formatting it at all.
 */
export function formatSummaryValue(
  value: number | undefined,
  item: DataTableSummaryItem,
  context: SummaryFormatContext
): string {
  if (value === undefined) return PENDING_VALUE
  if (item.function === 'count') return String(value)

  const column = context.columns?.find(
    (col): col is FieldColumn => 'field' in col && col.field === item.field
  )
  if (!column?.format) return String(value)

  return formatCellValue(
    value,
    column.format,
    context.locale,
    resolveCurrencyOptions(context.fieldMeta?.[item.field])
  )
}

/** `"Label: 42"`, or just `"42"` when the author declared no label. */
export function summaryCellText(
  value: number | undefined,
  item: DataTableSummaryItem,
  context: SummaryFormatContext
): string {
  return `${item.label ? `${item.label}: ` : ''}${formatSummaryValue(value, item, context)}`
}
