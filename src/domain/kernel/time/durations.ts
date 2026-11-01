/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fixed spans of time in milliseconds, for arithmetic on epoch instants.
 *
 * A "day" here is 86 400 000 ms of elapsed time, not a calendar day: across a
 * daylight-saving change a local calendar day is 23 or 25 hours long. Code
 * that steps through local dates reads them through a zone
 * (`zoned-calendar.ts`); these constants are for UTC instants, retention
 * windows and serial-date conversions, where every day is the same length.
 */

/** One minute in milliseconds. */
export const MINUTE_MS = 60_000

/** One hour in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS

/** One day of elapsed time in milliseconds. */
export const DAY_MS = 24 * HOUR_MS
