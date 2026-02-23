/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Time string parsing and formatting utilities
 *
 * Provides pure functions for converting between time strings (e.g., "100ms", "0.5s")
 * and millisecond values. Used for animation timing calculations.
 */

/**
 * Parse time string to milliseconds
 *
 * @param timeStr - Time string (e.g., "100ms", "0.5s", "1s")
 * @returns Time in milliseconds
 *
 * @example
 * parseTimeToMs('100ms') // => 100
 * parseTimeToMs('0.5s')  // => 500
 * parseTimeToMs('1s')    // => 1000
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

/**
 * Format milliseconds to time string
 *
 * @param ms - Time in milliseconds
 * @returns Time string in milliseconds format
 *
 * @example
 * formatMsToTime(100)  // => "100ms"
 * formatMsToTime(500)  // => "500ms"
 * formatMsToTime(1000) // => "1000ms"
 */
export function formatMsToTime(ms: number): string {
  return `${ms}ms`
}

/**
 * Calculate total delay including stagger offset
 *
 * Adds stagger delay based on child index to create sequential animation effects.
 * Commonly used for entrance animations of multiple child elements.
 *
 * @param delay - Base delay string (e.g., "100ms")
 * @param stagger - Stagger delay per sibling (e.g., "50ms")
 * @param childIndex - Current child index (0-based)
 * @returns Total delay string or undefined if no stagger
 *
 * @example
 * calculateTotalDelay('100ms', '50ms', 0) // => "100ms"
 * calculateTotalDelay('100ms', '50ms', 1) // => "150ms"
 * calculateTotalDelay('100ms', '50ms', 2) // => "200ms"
 * calculateTotalDelay('100ms', undefined, 2) // => "100ms"
 */
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
