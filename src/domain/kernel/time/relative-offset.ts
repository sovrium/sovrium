/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The offset between two instants, counted in the largest unit that holds a
 * whole one — days, else hours, else minutes — and truncated toward zero, so
 * an event 5 minutes and 50 seconds old is "5 minutes" and never rounded up to
 * a time that has not passed.
 *
 * Shared by every reader that phrases an instant relative to now through
 * `Intl.RelativeTimeFormat` (a table's `relative-time` column, an invitation's
 * deadline), so two surfaces on one page cannot disagree on the unit.
 */

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** A signed whole count of one `Intl.RelativeTimeFormat` unit. */
export interface RelativeOffset {
  /** Positive in the future, negative in the past; `0` under a whole minute. */
  readonly count: number
  readonly unit: 'day' | 'hour' | 'minute'
}

/** `diffMs` (target minus now, in milliseconds) in its largest whole unit. */
export const relativeOffset = (diffMs: number): RelativeOffset => {
  const magnitude = Math.abs(diffMs)
  const [unit, size] =
    magnitude >= DAY_MS
      ? (['day', DAY_MS] as const)
      : magnitude >= HOUR_MS
        ? (['hour', HOUR_MS] as const)
        : (['minute', MINUTE_MS] as const)
  const whole = Math.floor(magnitude / size)
  // `Math.sign(-x) * 0` is `-0`, which `Intl` phrases as a past "0 minutes".
  return { count: whole === 0 ? 0 : Math.sign(diffMs) * whole, unit }
}
