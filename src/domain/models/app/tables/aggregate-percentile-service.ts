/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The five percentiles an aggregate read computes, and the figure each names.
 *
 * A percentile is CONTINUOUS: the values are ranked ascending, empty values
 * left out, and the figure interpolated linearly between the values ranked
 * `floor(h)` and `ceil(h)`, `h = (n - 1) × p ÷ 100` — PostgreSQL's
 * `percentile_cont`, a spreadsheet's `PERCENTILE.INC`. Over 1..100 the p95 is
 * 95.05, where nearest-rank would answer 95. Over no values there is no
 * figure: `null`, never `0`.
 *
 * The list is closed: a `p`-and-digits name outside it is refused rather than
 * dropped, so a request for `p97` is told why it has no answer.
 */

/** The percentiles, in the order the refusal lists them. */
export const AGGREGATE_PERCENTILES = ['p50', 'p75', 'p90', 'p95', 'p99'] as const

/** One of the five percentiles. */
export type AggregatePercentile = (typeof AGGREGATE_PERCENTILES)[number]

/** The fields each requested percentile is computed over, keyed like `sum` and `avg`. */
export type PercentileFields = { readonly [P in AggregatePercentile]?: readonly string[] }

/** One answered percentile per field, `null` over no values. */
export type PercentileFigures = {
  readonly [P in AggregatePercentile]?: Readonly<Record<string, number | null>>
}

/** True for one of the five percentile names. */
export const isAggregatePercentile = (value: string): value is AggregatePercentile =>
  (AGGREGATE_PERCENTILES as readonly string[]).includes(value)

/** True for a name SHAPED like a percentile (`p` and digits), listed or not. */
export const looksLikePercentile = (value: string): boolean => /^p\d+$/.test(value)

/** The percentage a percentile names: `p95` → 95. */
export const percentOf = (percentile: AggregatePercentile): number => Number(percentile.slice(1))

/** The refusal of a percentile outside the five, naming those that exist. */
export const describeUnknownPercentile = (name: string): string =>
  `Unknown percentile '${name}'. The aggregate read computes ${AGGREGATE_PERCENTILES.join(', ')}`

/** Every field any percentile of `spec` is computed over, once each, in request order. */
export const percentileFieldsOf = (spec: PercentileFields): readonly string[] => [
  ...new Set(AGGREGATE_PERCENTILES.flatMap((percentile) => spec[percentile] ?? [])),
]

/**
 * The interpolated percentile of `values` — the figure the database answers —
 * or `undefined` over no finite value.
 */
export function interpolatePercentile(
  values: readonly number[],
  percentile: AggregatePercentile
): number | undefined {
  const sorted = values.filter((value) => Number.isFinite(value)).toSorted((a, b) => a - b)
  if (sorted.length === 0) return undefined
  const rank = ((sorted.length - 1) * percentOf(percentile)) / 100
  const low = sorted[Math.floor(rank)] ?? 0
  const high = sorted[Math.ceil(rank)] ?? low
  return low + (rank - Math.floor(rank)) * (high - low)
}
