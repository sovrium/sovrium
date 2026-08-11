/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Display formats applied to chart axis tick labels. Mirrors the domain
 * `AxisFormat` literal (`date | currency | number | percent`).
 */
export type ChartAxisFormat = 'date' | 'currency' | 'number' | 'percent'

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/**
 * Formats a raw X-axis key for display. With `format: 'date'` the key is
 * parsed as a date and rendered as `"<Month> <Year>"` (e.g. `"Jan 2025"`).
 * Non-date formats and unparseable values pass through unchanged.
 */
export function formatAxisLabel(raw: string, format: ChartAxisFormat | undefined): string {
  if (format === 'date') {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
      const month = MONTH_NAMES[parsed.getUTCMonth()] ?? ''
      return `${month} ${String(parsed.getUTCFullYear())}`
    }
    return raw
  }
  if (format === 'currency') return `$${formatNumber(raw)}`
  if (format === 'percent') return `${formatNumber(raw)}%`
  return raw
}

/**
 * Formats a numeric Y-axis tick value according to the axis `format`.
 * `currency` prefixes a `$`, `percent` suffixes a `%`, everything else
 * renders the bare number.
 */
export function formatAxisValue(value: number, format: ChartAxisFormat | undefined): string {
  if (format === 'currency') return `$${String(value)}`
  if (format === 'percent') return `${String(value)}%`
  return String(value)
}

/** Renders a numeric-looking string without trailing fractional noise. */
function formatNumber(raw: string): string {
  const num = Number(raw)
  return Number.isFinite(num) ? String(num) : raw
}
