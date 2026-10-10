/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  AGGREGATE_PERCENTILES,
  percentileFieldsOf,
  type AggregatePercentile,
  type PercentileFields,
  type PercentileFigures,
} from '@/domain/models/app/tables/aggregate-percentile-service'

/**
 * Aggregation helpers for the records list API.
 *
 * Handles both the shortcut `field:op,field:op` query form (which produces
 * flat scalar results) and the JSON form (per-field records), and names the
 * shape of one group of a grouped read (computed by the database, see
 * `record-groups.ts`).
 */

export interface AggregateConfig extends PercentileFields {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
  readonly shortcut?: boolean
}

/** A `min`/`max` answer: a number, or a date as its ISO string. */
type Ordered = number | string

/** A `sum`/`avg` answer, `null` over no values. */
type Numeric = number | null

/** A `min`/`max` answer, `null` over no values. */
type OrderedOrNull = Ordered | null

export type AggregationOutput = {
  readonly [P in AggregatePercentile]?: Numeric | Record<string, Numeric>
} & {
  readonly count?: string | number
  readonly sum?: Numeric | Record<string, Numeric>
  readonly avg?: Numeric | Record<string, Numeric>
  readonly min?: OrderedOrNull | Record<string, OrderedOrNull>
  readonly max?: OrderedOrNull | Record<string, OrderedOrNull>
}

export type RawAggregations = PercentileFigures & {
  readonly count?: string
  readonly sum?: Record<string, Numeric>
  readonly avg?: Record<string, Numeric>
  readonly min?: Record<string, OrderedOrNull>
  readonly max?: Record<string, OrderedOrNull>
}

/**
 * Puts one `min`/`max` answer in the form the records API reads its field as
 * (a `date` as its day); identity when omitted.
 */
export type OrderedAnswer = (field: string, value: Ordered) => Ordered

/** An aggregate over no values: `null` on the wire, where `undefined` would drop the key. */
const NO_VALUES = null

function collectAggregatedFields(aggregate: Readonly<AggregateConfig>): readonly string[] {
  return [
    ...(aggregate.sum ?? []),
    ...(aggregate.avg ?? []),
    ...(aggregate.min ?? []),
    ...(aggregate.max ?? []),
    ...percentileFieldsOf(aggregate),
  ]
}

function singleAggregatedField(aggregate: Readonly<AggregateConfig>): string | undefined {
  const distinct = [...new Set(collectAggregatedFields(aggregate))]
  return distinct.length === 1 ? distinct[0] : undefined
}

function pickFlatValue<V extends OrderedOrNull>(
  rec: Readonly<Record<string, V>> | undefined,
  field: string
): V | undefined {
  return rec && rec[field] !== undefined ? rec[field] : undefined
}

/** Every `min`/`max` answer of `raw` put in its field's form by `answer`. */
export function answerOrderedAggregations(
  raw: RawAggregations,
  answer: OrderedAnswer
): RawAggregations {
  const shape = (rec: Readonly<Record<string, OrderedOrNull>> | undefined) =>
    rec === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(rec).map(([field, value]) => [
            field,
            value === null ? NO_VALUES : answer(field, value),
          ])
        )
  const min = shape(raw.min)
  const max = shape(raw.max)
  return { ...raw, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) }
}

/**
 * Reshape aggregation output for the shortcut form with a single aggregated
 * field: flatten `sum: { amount: 600 }` to `sum: 600` (and `p95: { ms: 105 }` to `p95: 105`).
 */
export function reshapeShortcutAggregations(
  raw: RawAggregations,
  aggregate: Readonly<AggregateConfig>
): AggregationOutput {
  const field = singleAggregatedField(aggregate)
  if (!field) return raw

  const sumVal = pickFlatValue(raw.sum, field)
  const avgVal = pickFlatValue(raw.avg, field)
  const minVal = pickFlatValue(raw.min, field)
  const maxVal = pickFlatValue(raw.max, field)
  const countVal = raw.count !== undefined ? Number(raw.count) : undefined
  const percentiles = Object.fromEntries(
    AGGREGATE_PERCENTILES.flatMap((p) => {
      const value = pickFlatValue(raw[p], field)
      return value === undefined ? [] : [[p, value] as const]
    })
  )

  return {
    ...(countVal !== undefined ? { count: countVal } : {}),
    ...(sumVal !== undefined ? { sum: sumVal } : {}),
    ...(avgVal !== undefined ? { avg: avgVal } : {}),
    ...(minVal !== undefined ? { min: minVal } : {}),
    ...(maxVal !== undefined ? { max: maxVal } : {}),
    ...percentiles,
  }
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
