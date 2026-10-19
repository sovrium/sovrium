/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The instant types a drawer entry prints as a date-time. */
const INSTANT_ENTRY_TYPES: ReadonlySet<string> = new Set([
  'datetime',
  'created-at',
  'updated-at',
  'deleted-at',
])

/**
 * A date-time entry over a SYSTEM source, stamped to read through the grid's
 * `datetime` column format: a system row has no field schema, so that format is
 * the only way its grid prints the instant, and the drawer prints it the same.
 */
export function withSystemDateTime(entry: unknown, system: boolean): unknown {
  if (!system || typeof entry !== 'object' || entry === null) return entry
  const { type } = entry as Readonly<Record<string, unknown>>
  return typeof type === 'string' && INSTANT_ENTRY_TYPES.has(type)
    ? { ...entry, format: 'datetime' }
    : entry
}
