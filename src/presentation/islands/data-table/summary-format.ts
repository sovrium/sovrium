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

import { resolveCurrencyOptions } from '@/domain/kernel/format/currency-format'
import { formatCellValue } from '@/domain/models/app/tables/cell-value-format'
import { defaultAlignOfFieldType } from '@/domain/models/app/tables/field-type-presentation-service'
import { formatRecordText } from '@/domain/models/app/tables/record-text-service'
import { resolvePageTimezone } from '../runtime/page-timezone'
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
/** The declared column a summary describes, when there is one. */
const summaryColumn = (field: string, context: SummaryFormatContext): FieldColumn | undefined =>
  context.columns?.find((col): col is FieldColumn => 'field' in col && col.field === field)

/**
 * A summary of a column declaring no `format` reads as the column's cells do:
 * a currency field in its currency, a percentage as a percentage, anything
 * else as its stored number.
 */
function formatByFieldType(value: number, field: string, context: SummaryFormatContext): string {
  const meta = context.fieldMeta?.[field]
  if (meta?.type === 'currency') {
    const currency = resolveCurrencyOptions(meta)
    return formatRecordText(
      value,
      { format: 'currency', ...(currency === undefined ? {} : { currency }) },
      context.locale
    )
  }
  if (meta?.type === 'percentage') {
    const precision = meta.display?.precision
    return formatRecordText(
      value,
      { format: 'percent', ...(precision === undefined ? {} : { precision }) },
      context.locale
    )
  }
  return String(value)
}

/**
 * The alignment a summary cell takes: its column's declared `align`, else the
 * field type's default (quantities to the right), so the figure sits where the
 * column's values do.
 */
export function summaryAlignClass(field: string, context: SummaryFormatContext): string {
  const align =
    summaryColumn(field, context)?.align ??
    defaultAlignOfFieldType(context.fieldMeta?.[field]?.type)
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return ''
}

export function formatSummaryValue(
  value: number | undefined,
  item: DataTableSummaryItem,
  context: SummaryFormatContext
): string {
  if (value === undefined) return PENDING_VALUE
  if (item.function === 'count') return String(value)

  const column = summaryColumn(item.field, context)
  if (!column?.format) return formatByFieldType(value, item.field, context)

  return formatCellValue(value, column.format, context.locale, {
    currency: resolveCurrencyOptions(context.fieldMeta?.[item.field]),
    timeZone: resolvePageTimezone(),
    durationUnit: context.fieldMeta?.[item.field]?.type === 'duration' ? 'seconds' : undefined,
  })
}

/** `"Label: 42"`, or just `"42"` when the author declared no label. */
export function summaryCellText(
  value: number | undefined,
  item: DataTableSummaryItem,
  context: SummaryFormatContext
): string {
  return `${item.label ? `${item.label}: ` : ''}${formatSummaryValue(value, item, context)}`
}
