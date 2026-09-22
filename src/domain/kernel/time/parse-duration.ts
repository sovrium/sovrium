/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

const MS_PER_UNIT = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const

type Unit = keyof typeof MS_PER_UNIT

/**
 * Parse a duration string (or plain integer) into milliseconds.
 *
 * Accepted formats:
 *   - "5s", "10m", "2h", "7d" — integer + unit suffix (s/m/h/d)
 *   - "300" — plain integer interpreted as milliseconds
 *
 * Returns NaN on any other input. Callers handle invalid values explicitly
 * (e.g. by skipping the TTL or returning a configuration error). Returning
 * NaN is preferred over throwing because most callers want a soft fallback.
 */
export function parseDuration(input: string): number {
  const trimmed = input.trim()
  if (trimmed.length === 0) return NaN

  const match = trimmed.match(/^(\d+)([smhd])?$/)
  if (!match) return NaN

  const amount = Number(match[1])
  const suffix = match[2] as Unit | undefined
  if (!Number.isFinite(amount)) return NaN

  return suffix === undefined ? amount : amount * MS_PER_UNIT[suffix]
}
