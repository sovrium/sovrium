/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * "2 hours ago", "yesterday", "now" — an instant as a person says it, in the
 * page language, for a record sheet's footer and its Activity tab. Never the
 * stored instant: a reader asked when, not which millisecond.
 */

import { resolvePageLocale } from '../runtime/page-locale'

const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

/** An ISO instant relative to now, or `''` for a value that names no instant. */
export function relativeTimeText(instant: unknown, now: number = Date.now()): string {
  if (typeof instant !== 'string' && typeof instant !== 'number') return ''
  const at = new Date(instant).getTime()
  if (Number.isNaN(at)) return ''
  const seconds = Math.round((at - now) / 1000)
  const [unit, size] = UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? ['second', 1]
  const format = new Intl.RelativeTimeFormat(resolvePageLocale(), { numeric: 'auto' })
  return format.format(Math.round(seconds / size), unit)
}
