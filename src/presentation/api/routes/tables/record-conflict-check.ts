/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export function isStaleWrite(config: {
  readonly clientUpdatedAt: string | undefined
  readonly storedRecord: Record<string, unknown> | undefined
}): boolean {
  const { clientUpdatedAt, storedRecord } = config

  if (clientUpdatedAt === undefined) return false
  if (!storedRecord) return false

  const storedUpdatedAt = storedRecord['updated_at']
  if (storedUpdatedAt === undefined || storedUpdatedAt === null) return false

  const clientEpoch = toEpoch(clientUpdatedAt)
  const storedEpoch = toEpoch(storedUpdatedAt)
  if (clientEpoch === undefined || storedEpoch === undefined) return false

  return clientEpoch !== storedEpoch
}
