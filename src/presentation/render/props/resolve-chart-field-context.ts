/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  resolveCurrencyOptions,
  type CurrencyDisplayOptions,
} from '@/domain/kernel/format/currency-format'
import {
  optionLabel,
  optionValue,
  type SelectOptionLike,
} from '@/domain/models/app/tables/select-option'
import { resolveFieldDisplayMeta } from './resolve-field-cell-meta'
import type { ComponentOfType } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/**
 * What a chart or a KPI needs to know about the fields it names, resolved from
 * `app.tables` on the server — the islands receive records, never the schema.
 *
 * Deliberately narrow: only the grouping field's options and the plotted
 * field's currency display travel, never the table's whole field metadata, so
 * the island props of a dashboard full of charts stay small.
 */

/** One declared option of a grouping field, as the chart island reads it. */
export interface ChartCategoryOptionInput {
  readonly value: string
  readonly label: string
  readonly color?: string
}

/** The field types whose declared options give a chart its category order. */
const OPTION_ORDERED_TYPES: ReadonlySet<string> = new Set(['single-select', 'status'])

/** The currency display keys the shared formatter reads — nothing else travels. */
const CURRENCY_KEYS = [
  'currency',
  'precision',
  'symbolPosition',
  'negativeFormat',
  'thousandsSeparator',
] as const

type TableField = Tables[number]['fields'][number]
type ChartComponent = ComponentOfType<'chart'>
type KpiComponent = ComponentOfType<'kpi'>

const findField = (table: Tables[number], name: string | undefined): TableField | undefined =>
  name === undefined ? undefined : table.fields.find((field) => field.name === name)

/**
 * The declared options of a `single-select` or `status` grouping field, in
 * declared order, each with its label and colour; `undefined` for any other
 * field, which keeps its categories sorted by name.
 */
export function resolveCategoryOptions(
  table: Tables[number],
  fieldName: string | undefined
): readonly ChartCategoryOptionInput[] | undefined {
  const field = findField(table, fieldName)
  if (!field || !OPTION_ORDERED_TYPES.has(field.type)) return undefined
  if (!('options' in field) || !Array.isArray(field.options)) return undefined
  const options = (field.options as readonly SelectOptionLike[]).map((option) => {
    const color = typeof option === 'string' ? undefined : option.color
    return {
      value: optionValue(option),
      label: optionLabel(option),
      ...(color === undefined ? {} : { color }),
    }
  })
  return options.length > 0 ? options : undefined
}

/**
 * The currency display a field declares — its code, precision and the
 * separators it names — or `undefined` when it declares no currency.
 */
export function resolveValueCurrency(
  table: Tables[number],
  fieldName: string | undefined
): CurrencyDisplayOptions | undefined {
  const field = findField(table, fieldName)
  if (!field) return undefined
  const display = resolveFieldDisplayMeta(field as Readonly<Record<string, unknown>>)
  const currency = resolveCurrencyOptions({
    type: field.type,
    display: display as CurrencyDisplayOptions | undefined,
  })
  if (currency === undefined) return undefined
  const picked = CURRENCY_KEYS.flatMap((key) =>
    currency[key] === undefined ? [] : [[key, currency[key]] as const]
  )
  return Object.fromEntries(picked) as CurrencyDisplayOptions
}

/** The chart's category field: the aggregate's grouping, else the X axis. */
const chartCategoryField = (component: ChartComponent): string | undefined =>
  component.chartAggregate?.groupBy ?? component.xAxis?.field

/**
 * The chart's plotted field: the aggregated field (none for a count, which
 * plots a number of records rather than an amount), else the Y axis.
 */
const chartValueField = (component: ChartComponent): string | undefined =>
  component.chartAggregate === undefined
    ? component.yAxis?.field
    : component.chartAggregate.function === 'count'
      ? undefined
      : component.chartAggregate.field

/** Two currency displays that print the same tick. */
const sameCurrency = (a: CurrencyDisplayOptions, b: CurrencyDisplayOptions): boolean =>
  CURRENCY_KEYS.every((key) => a[key] === b[key])

/**
 * The currency a series-bound chart's ONE value axis can print: the display
 * every series' field declares, when they all declare the same one. A series
 * over a plain number field, or two series in different currencies, leave the
 * axis without a field currency — one axis cannot name two.
 */
function resolveSeriesCurrency(
  table: Tables[number],
  series: NonNullable<ChartComponent['series']>
): CurrencyDisplayOptions | undefined {
  const displays = series.map((entry) => resolveValueCurrency(table, entry.field))
  const [first] = displays
  if (first === undefined) return undefined
  return displays.every((display) => display !== undefined && sameCurrency(display, first))
    ? first
    : undefined
}

/** Both halves of a chart's field context, from its source table. */
export function resolveChartFieldContext(
  table: Tables[number],
  component: ChartComponent
): {
  readonly categoryOptions: readonly ChartCategoryOptionInput[] | undefined
  readonly valueCurrency: CurrencyDisplayOptions | undefined
} {
  return {
    categoryOptions: resolveCategoryOptions(table, chartCategoryField(component)),
    valueCurrency: resolveValueCurrency(table, chartValueField(component)),
  }
}

/** A KPI's aggregated field's currency display (none for a count). */
export function resolveKpiValueCurrency(
  table: Tables[number],
  component: KpiComponent
): CurrencyDisplayOptions | undefined {
  const aggregate = component.kpiAggregate
  if (aggregate === undefined || aggregate.function === 'count') return undefined
  return resolveValueCurrency(table, aggregate.field)
}

/**
 * The field context of a chart or a KPI, from its source table. A
 * series-bound chart takes no category options — its series carry their own
 * colours — and its axis currency is the one its series' fields share; a KPI
 * takes only its aggregated field's currency.
 */
export function resolveFigureFieldContext(
  figure:
    | { readonly type: 'chart'; readonly component: ChartComponent }
    | {
        readonly type: 'kpi'
        readonly component: KpiComponent
      },
  table: Tables[number]
): {
  readonly categoryOptions?: readonly ChartCategoryOptionInput[]
  readonly valueCurrency?: CurrencyDisplayOptions
} {
  if (figure.type === 'kpi') {
    return { valueCurrency: resolveKpiValueCurrency(table, figure.component) }
  }
  const { series } = figure.component
  if (series !== undefined && series.length > 0) {
    return { valueCurrency: resolveSeriesCurrency(table, series) }
  }
  return resolveChartFieldContext(table, figure.component)
}
