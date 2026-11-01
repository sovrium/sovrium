/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A count as an `audience-only` report answers it: 0 stays 0, a count from 1
 * to 9 reads 10, and any other count reads the nearest 10, a half rounding up
 * (15 reads 20).
 *
 * A small count never reads 0, so a report never claims nothing happened when
 * something did; and no count is answered to the unit, so two windows cannot be
 * subtracted down to one event.
 */
export function roundReportCount(count: number): number {
  if (count <= 0) return 0
  if (count < 10) return 10
  return Math.floor((count + 5) / 10) * 10
}

/** One counted entry of a breakdown, with its share of the rounded total (0-100, two decimals). */
export type RoundedShare<E> = Omit<E, 'count' | 'percentage'> & {
  readonly count: number
  readonly percentage: number
}

/**
 * A breakdown as an `audience-only` report answers it: each count rounded by
 * {@link roundReportCount}, each share computed over the sum of the ROUNDED
 * counts, and that sum as the total. A share computed over the stored counts
 * would let a reader recover them.
 */
export function roundedShares<E extends { readonly count: number }>(
  entries: readonly E[]
): { readonly entries: readonly RoundedShare<E>[]; readonly total: number } {
  const counts = entries.map((entry) => roundReportCount(entry.count))
  const total = counts.reduce((sum, count) => sum + count, 0)
  return {
    entries: entries.map((entry, index) => {
      const count = counts[index] ?? 0
      return {
        ...entry,
        count,
        percentage: total === 0 ? 0 : Math.round((count / total) * 10_000) / 100,
      }
    }),
    total,
  }
}
