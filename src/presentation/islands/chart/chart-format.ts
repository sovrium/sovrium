/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export function formatAxisValue(value: number, format: ChartAxisFormat | undefined): string {
  if (format === 'currency') return `$${String(value)}`
  if (format === 'percent') return `${String(value)}%`
  return String(value)
}

function formatNumber(raw: string): string {
  const num = Number(raw)
  return Number.isFinite(num) ? String(num) : raw
}
