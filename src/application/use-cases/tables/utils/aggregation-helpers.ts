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
 * One partition of the view: the ancestor values that name it, and its numbers.
 *
 * `path` carries the value at every level from the outermost down to this one,
 * so `["EMEA","Prospect"]` is a DIFFERENT partition from `["AMER","Prospect"]`.
 * That is the whole reason the path exists: once a grid groups more than one
 * level deep a group's own value stops being a key, and a count attributed to
 * "the Prospect group" no longer says which one it describes.
 */
export interface GroupPartition {
  /** This partition's own value — the last entry of {@link GroupPartition.path}. */
  readonly name: string
  /** Ancestor values, outermost first, ending in this partition's own. */
  readonly path: readonly string[]
  readonly count: number
  /** Present only when the request also carried `?aggregate=`. */
  readonly aggregations?: AggregationOutput
}

/** The path a record belongs to at one depth, as a comparable key. */
function pathKeyOf(record: Readonly<Record<string, unknown>>, levels: readonly string[]): string {
  return JSON.stringify(levels.map((field) => toGroupName(record, field)))
}

/**
 * Partition records by EVERY prefix of the grouping levels, in first-seen order.
 *
 * One level in, this returns exactly what the single-field partition always
 * returned. Two levels in it returns the level-1 partitions AND the level-2
 * ones, because a nested grid renders a header — and so needs a count and a
 * total — at every depth, not only the innermost. Answering only the deepest
 * would destroy the parent-versus-child comparison that is the reason to nest.
 *
 * Runs over the whole filtered result set rather than one page, so a group that
 * spills past a page boundary still reports its view-wide numbers.
 */
export function computeGroupPartitions(
  records: readonly Readonly<Record<string, unknown>>[],
  levels: readonly string[],
  aggregate?: AggregateConfig
): readonly GroupPartition[] {
  return levels.flatMap((_field, index) => {
    const prefix = levels.slice(0, index + 1)
    const keys = records.reduce<readonly string[]>((acc, record) => {
      const key = pathKeyOf(record, prefix)
      return acc.includes(key) ? acc : [...acc, key]
    }, [])
    return keys.map((key) => {
      const path = JSON.parse(key) as readonly string[]
      const partition = records.filter((record) => pathKeyOf(record, prefix) === key)
      const raw = aggregate ? buildRawAggregationsForGroup(partition, aggregate) : undefined
      return {
        name: path[path.length - 1] ?? '',
        path,
        count: partition.length,
        ...(raw && aggregate
          ? { aggregations: aggregate.shortcut ? reshapeShortcutAggregations(raw, aggregate) : raw }
          : {}),
      }
    })
  })
}
