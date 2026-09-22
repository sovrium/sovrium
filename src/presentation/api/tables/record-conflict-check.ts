/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Normalize an `updated_at` token into a comparable millisecond timestamp.
 *
 * Accepts `Date` objects (raw Drizzle rows) and ISO-8601 strings (client
 * tokens). Comparison is done on the parsed epoch value so that timezone
 * notation differences (`Z` vs `+00:00`) and millisecond precision do not
 * cause false-positive conflicts. Returns `undefined` for unparseable input.
 */
function toEpoch(value: unknown): number | undefined {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isNaN(ms) ? undefined : ms
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? undefined : ms
  }
  return undefined
}

/**
 * Optimistic-locking comparison for record updates.
 *
 * When the PATCH request carries an `updatedAt` token, the stored record's
 * `updated_at` column is compared against it. A mismatch means the record
 * was modified after the client last read it (a stale write).
 *
 * Returns `true` when a stale write is detected and the update must be
 * rejected with `409 Conflict`. Returns `false` when the check passes —
 * matching token, no token supplied, the table does not track `updated_at`,
 * or either value is unparseable (skip rather than block a legitimate write
 * on a malformed comparison).
 */
export function isStaleWrite(config: {
  readonly clientUpdatedAt: string | undefined
  readonly storedRecord: Record<string, unknown> | undefined
}): boolean {
  const { clientUpdatedAt, storedRecord } = config

  // No token supplied — caller opted out of optimistic locking.
  if (clientUpdatedAt === undefined) return false
  if (!storedRecord) return false

  const storedUpdatedAt = storedRecord['updated_at']
  // The table does not track `updated_at` — nothing to compare against.
  if (storedUpdatedAt === undefined || storedUpdatedAt === null) return false

  const clientEpoch = toEpoch(clientUpdatedAt)
  const storedEpoch = toEpoch(storedUpdatedAt)
  if (clientEpoch === undefined || storedEpoch === undefined) return false

  return clientEpoch !== storedEpoch
}
