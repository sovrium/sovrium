/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isNumericFormulaResult } from './formula-result-type-service'

/**
 * The currency display a field is SHOWN in, which for a rollup is not always
 * the one it declares.
 *
 * A rollup has exactly one source field. When it sums, averages or picks the
 * smallest or largest of a `currency` field, the result is money in that
 * field's currency, so it takes the source's `currency`, `precision`,
 * `symbolPosition`, `negativeFormat` and `thousandsSeparator`. Whatever the
 * rollup declares itself overrides that one key, so `precision: 0` alone keeps
 * the source's code. A COUNT, COUNTA, COUNTALL or ARRAYUNIQUE counts or lists
 * records and never inherits.
 *
 * ONE function for every surface that prints an amount (the records API's
 * `?format=display`, a grid cell, its summary, a kanban footer, a chart axis),
 * so a rollup can never read `€` on one and a bare number on another.
 */

/** The five display keys a currency field carries, and a rollup inherits. */
export const CURRENCY_DISPLAY_KEYS = [
  'currency',
  'precision',
  'symbolPosition',
  'negativeFormat',
  'thousandsSeparator',
] as const

/** The aggregations whose result is an amount of the source field (case-insensitive). */
const AMOUNT_AGGREGATIONS: ReadonlySet<string> = new Set(['sum', 'avg', 'min', 'max'])

type FieldLike = Readonly<Record<string, unknown>> & {
  readonly name: string
  readonly type: string
}

interface TableLike {
  readonly name: string
  readonly fields: readonly FieldLike[]
}

const findField = (table: TableLike | undefined, name: unknown): FieldLike | undefined =>
  typeof name === 'string' ? table?.fields.find((field) => field.name === name) : undefined

/** The row id every table carries without declaring it: an integer. */
const IMPLICIT_ID: FieldLike = { name: 'id', type: 'integer' }

/**
 * The field a rollup reads in its related table, through its relationship, or
 * `undefined` when the relationship or the source does not resolve. `id` is
 * never declared but always there, as validation reads it.
 */
const rollupSourceOf = (
  field: FieldLike,
  table: TableLike,
  tables: readonly TableLike[]
): FieldLike | undefined => {
  const link = findField(table, field['relationshipField'])
  if (link?.type !== 'relationship') return undefined
  const related = tables.find((candidate) => candidate.name === link['relatedTable'])
  if (related === undefined) return undefined
  return field['relatedField'] === 'id' ? IMPLICIT_ID : findField(related, field['relatedField'])
}

/** A rollup's aggregation, lower-cased; empty when it declares none. */
const aggregationOf = (field: FieldLike): string =>
  typeof field.aggregation === 'string' ? field.aggregation.toLowerCase() : ''

/**
 * The `currency` field a rollup aggregates as an amount, or `undefined` when
 * the field is not such a rollup: another type, a counting aggregation, a
 * relationship that does not resolve, or a source that is not a `currency`.
 */
export const rollupCurrencySource = (
  field: FieldLike,
  table: TableLike,
  tables: readonly TableLike[]
): FieldLike | undefined => {
  if (field.type !== 'rollup' || !AMOUNT_AGGREGATIONS.has(aggregationOf(field))) return undefined
  const source = rollupSourceOf(field, table, tables)
  return source?.type === 'currency' ? source : undefined
}

/** What a rollup computes, which decides how its value is drawn. */
export type RollupResultKind = 'currency' | 'number' | 'list' | 'text'

/** The aggregations whose result is a number of records, whatever they read. */
const COUNTING_AGGREGATIONS: ReadonlySet<string> = new Set(['count', 'counta', 'countall'])

/** The source types an amount aggregation turns into a plain number. */
const NUMERIC_SOURCE_TYPES: ReadonlySet<string> = new Set([
  'number',
  'integer',
  'decimal',
  'percentage',
  'autonumber',
  'count',
  'duration',
])

/**
 * What a sum, average, minimum or maximum of `source` is. A formula reads as its
 * declared result: a number only when validation also counts it as one, and no
 * currency is ever inferred from it.
 */
const amountResultKind = (source: FieldLike | undefined): RollupResultKind => {
  if (source?.type === 'currency') return 'currency'
  const numeric =
    source?.type === 'formula'
      ? isNumericFormulaResult(source['resultType'])
      : NUMERIC_SOURCE_TYPES.has(source?.type ?? '')
  return numeric ? 'number' : 'text'
}

/**
 * What a rollup's value IS, read from its aggregation and its source: money in
 * the source's currency (an amount aggregation over a `currency` field), a
 * number (a count of records, or an amount aggregation over a numeric field,
 * the row `id`, or a formula whose `resultType` is numeric),
 * a list (`ARRAYUNIQUE`), else text — the earliest name, a source that does not
 * resolve. `undefined` for a field that is not a rollup.
 */
export const rollupResultKind = (
  field: FieldLike,
  table: TableLike,
  tables: readonly TableLike[]
): RollupResultKind | undefined => {
  if (field.type !== 'rollup') return undefined
  const aggregation = aggregationOf(field)
  if (aggregation === 'arrayunique') return 'list'
  if (COUNTING_AGGREGATIONS.has(aggregation)) return 'number'
  if (!AMOUNT_AGGREGATIONS.has(aggregation)) return 'text'
  return amountResultKind(rollupSourceOf(field, table, tables))
}

/**
 * The field as it is displayed: an amount rollup over a `currency` field
 * carries the source's five display keys, each overridden by the rollup's own
 * declaration. Any other field comes back as it is.
 */
export const withInheritedCurrency = <F extends FieldLike>(
  field: F,
  table: TableLike,
  tables: readonly TableLike[]
): F => {
  const source = rollupCurrencySource(field, table, tables)
  if (source === undefined) return field
  const inherited = CURRENCY_DISPLAY_KEYS.flatMap((key) =>
    field[key] === undefined && source[key] !== undefined ? [[key, source[key]] as const] : []
  )
  return inherited.length === 0 ? field : { ...field, ...Object.fromEntries(inherited) }
}
