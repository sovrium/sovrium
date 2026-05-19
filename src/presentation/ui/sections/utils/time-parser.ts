/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export function parseTimeToMs(timeStr: string): number {
  if (timeStr.endsWith('ms')) {
    return parseInt(timeStr.slice(0, -2), 10)
  }
  if (timeStr.endsWith('s')) {
    return parseFloat(timeStr.slice(0, -1)) * 1000
  }
  return 0
}

export function formatMsToTime(ms: number): string {
  return `${ms}ms`
}

export function calculateTotalDelay(
  delay: string | undefined,
  stagger: string | undefined,
  childIndex: number | undefined
): string | undefined {
  if (!stagger || childIndex === undefined) {
    return delay
  }

  const baseDelayMs = delay ? parseTimeToMs(delay) : 0
  const staggerMs = parseTimeToMs(stagger)
  const totalDelayMs = baseDelayMs + staggerMs * childIndex

  return formatMsToTime(totalDelayMs)
}
