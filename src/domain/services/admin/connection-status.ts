/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  CONNECTION_EXPIRING_SOON_WINDOW_MS,
  type ConnectionRowAction,
  type ConnectionStatus,
} from '@/domain/models/api/admin/connections/connections'


const toEpochMs = (
  expiresAt: Readonly<Date> | string | number | null | undefined
): number | null => {
  if (expiresAt === null || expiresAt === undefined) return null
  if (typeof expiresAt === 'number') return Number.isNaN(expiresAt) ? null : expiresAt
  const ms = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime()
  return Number.isNaN(ms) ? null : ms
}

export const deriveConnectionStatus = (
  expiresAt: Readonly<Date> | string | number | null | undefined,
  now: number = Date.now()
): ConnectionStatus => {
  const expiry = toEpochMs(expiresAt)
  if (expiry === null) return 'active'
  if (expiry <= now) return 'expired'
  if (expiry - now <= CONNECTION_EXPIRING_SOON_WINDOW_MS) return 'expiring-soon'
  return 'active'
}

export const soonestExpiryMs = (
  expiries: readonly (Readonly<Date> | string | null | undefined)[]
): number | null => {
  const defined = expiries.map((e) => toEpochMs(e)).filter((ms): ms is number => ms !== null)
  if (defined.length === 0) return null
  return Math.min(...defined)
}

export const deriveConnectionRowAction = (
  type: string,
  tokenCount: number,
  status: ConnectionStatus
): ConnectionRowAction => {
  if (type !== 'oauth2') return 'none'
  if (tokenCount === 0) return 'connect'
  if (status === 'expired' || status === 'expiring-soon') return 'reconnect'
  return 'disconnect'
}
