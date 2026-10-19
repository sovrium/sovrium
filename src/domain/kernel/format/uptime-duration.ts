/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatElapsedDuration, type DurationInputUnit } from './duration-format'

const SECONDS_PER_DAY = 86_400
const SECONDS_PER_HOUR = 3600

/**
 * An elapsed time that may run to days — an uptime, a process's CPU time — as
 * one compact readout: {@link formatElapsedDuration} under a day (`8.9 s`,
 * `2 min 50 s`, `1 h 05 min`), then days and hours (`6 d 4 h`, « 6 j 4 h »
 * on a French page). Two units at most, as below a day.
 *
 * Kept beside the elapsed-time formatter rather than inside it: a run time or a
 * cell never lasts a day, and every island that formats a cell carries that
 * module, so the day arithmetic is paid only by the readouts that need it.
 *
 * Returns `undefined` for a value that names no duration.
 */
export const formatLongDuration = (
  value: unknown,
  locale = 'en-US',
  unit: DurationInputUnit = 'milliseconds'
): string | undefined => {
  const count = typeof value === 'string' ? Number(value) : value
  const seconds =
    typeof count === 'number' ? (unit === 'seconds' ? count : count / 1000) : Number.NaN
  if (!(seconds >= SECONDS_PER_DAY) || seconds === Infinity) {
    return formatElapsedDuration(value, locale, unit)
  }
  const whole = Math.round(seconds)
  const days = Math.floor(whole / SECONDS_PER_DAY)
  const hours = Math.floor((whole % SECONDS_PER_DAY) / SECONDS_PER_HOUR)
  const day = `${String(days)} ${/^fr(-|$)/i.test(locale) ? 'j' : 'd'}`
  return hours === 0 ? day : `${day} ${String(hours)} h`
}
