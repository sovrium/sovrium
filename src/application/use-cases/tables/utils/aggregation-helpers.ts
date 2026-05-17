/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Aggregation helpers for the records list API.
 *
 * Handles both the shortcut `field:op,field:op` query form (which produces
 * flat scalar results) and the JSON form (per-field records). Also provides
 * in-memory grouped aggregations for the `?groupBy=field` parameter.
 */

export interface AggregateConfig {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
  readonly shortcut?: boolean
}

export type AggregationOutput = {
  readonly count?: string | number
  readonly sum?: number | Record<string, number>
  readonly avg?: number | Record<string, number>
  readonly min?: number | Record<string, number>
  readonly max?: number | Record<string, number>
}

export type RawAggregations = {
  readonly count?: string
  readonly sum?: Record<string, number>
  readonly avg?: Record<string, number>
  readonly min?: Record<string, number>
  readonly max?: Record<string, number>
}

type NumericOp = 'sum' | 'avg' | 'min' | 'max'

function collectAggregatedFields(aggregate: AggregateConfig): readonly string[] {
  return [
    ...(aggregate.sum ?? []),
    ...(aggregate.avg ?? []),
    ...(aggregate.min ?? []),
    ...(aggregate.max ?? []),
  ]
}

function singleAggregatedField(aggregate: AggregateConfig): string | undefined {
  const distinct = [...new Set(collectAggregatedFields(aggregate))]
  return distinct.length === 1 ? distinct[0] : undefined
}

function pickFlatValue(rec: Record<string, number> | undefined, field: string): number | undefined {
  return rec && rec[field] !== undefined ? rec[field] : undefined
}

/**
 * Reshape aggregation output for the shortcut form with a single aggregated
 * field: flatten `sum: { amount: 600 }` to `sum: 600`.
 */
export function reshapeShortcutAggregations(
  raw: RawAggregations,
  aggregate: AggregateConfig
): AggregationOutput {
  const field = singleAggregatedField(aggregate)
  if (!field) return raw

  const sumVal = pickFlatValue(raw.sum, field)
  const avgVal = pickFlatValue(raw.avg, field)
  const minVal = pickFlatValue(raw.min, field)
  const maxVal = pickFlatValue(raw.max, field)
  const countVal = raw.count !== undefined ? Number(raw.count) : undefined

  return {
    ...(countVal !== undefined ? { count: countVal } : {}),
    ...(sumVal !== undefined ? { sum: sumVal } : {}),
    ...(avgVal !== undefined ? { avg: avgVal } : {}),
    ...(minVal !== undefined ? { min: minVal } : {}),
    ...(maxVal !== undefined ? { max: maxVal } : {}),
  }
}

function extractNumericValues(
  records: readonly Readonly<Record<string, unknown>>[],
  field: string
): readonly number[] {
  return records
    .map((r) => r[field])
    .filter((v): v is number | string => v !== null && v !== undefined)
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n))
}

function applyNumericOp(values: readonly number[], op: NumericOp): number {
  if (op === 'sum') return values.reduce((s, n) => s + n, 0)
  if (op === 'avg') return values.reduce((s, n) => s + n, 0) / values.length
  if (op === 'min') return Math.min(...values)
  return Math.max(...values)
}

/**
 * Compute a numeric aggregation for each of the requested fields.
 */
export function aggregateNumeric(
  records: readonly Readonly<Record<string, unknown>>[],
  fields: readonly string[],
  op: NumericOp
): Record<string, number> {
  return fields.reduce<Record<string, number>>((acc, field) => {
    const values = extractNumericValues(records, field)
    if (values.length === 0) return acc
    return { ...acc, [field]: applyNumericOp(values, op) }
  }, {})
}

function buildRawAggregationsForGroup(
  groupRecords: readonly Readonly<Record<string, unknown>>[],
  aggregate: AggregateConfig
): RawAggregations {
  return {
    ...(aggregate.count ? { count: String(groupRecords.length) } : {}),
    ...(aggregate.sum && aggregate.sum.length > 0
      ? { sum: aggregateNumeric(groupRecords, aggregate.sum, 'sum') }
      : {}),
    ...(aggregate.avg && aggregate.avg.length > 0
      ? { avg: aggregateNumeric(groupRecords, aggregate.avg, 'avg') }
      : {}),
    ...(aggregate.min && aggregate.min.length > 0
      ? { min: aggregateNumeric(groupRecords, aggregate.min, 'min') }
      : {}),
    ...(aggregate.max && aggregate.max.length > 0
      ? { max: aggregateNumeric(groupRecords, aggregate.max, 'max') }
      : {}),
  }
}

function toGroupName(record: Readonly<Record<string, unknown>>, groupBy: string): string {
  const raw = record[groupBy]
  return raw === null || raw === undefined ? '' : String(raw)
}

/**
 * Compute grouped aggregations by partitioning records in-memory.
 *
 * Groups records by the `groupBy` column value (preserving first-seen order),
 * then computes the requested aggregations for each group. Suitable for small
 * to moderate record sets — a database-level GROUP BY would be preferable for
 * large datasets.
 */
export function computeGroupedAggregations(
  records: readonly Readonly<Record<string, unknown>>[],
  groupBy: string,
  aggregate: AggregateConfig
): readonly { readonly name: string; readonly aggregations: AggregationOutput }[] {
  const groupNames = records.reduce<readonly string[]>((acc, r) => {
    const name = toGroupName(r, groupBy)
    return acc.includes(name) ? acc : [...acc, name]
  }, [])

  return groupNames.map((name) => {
    const groupRecords = records.filter((r) => toGroupName(r, groupBy) === name)
    const raw = buildRawAggregationsForGroup(groupRecords, aggregate)
    const reshaped = aggregate.shortcut ? reshapeShortcutAggregations(raw, aggregate) : raw
    return { name, aggregations: reshaped }
  })
}
