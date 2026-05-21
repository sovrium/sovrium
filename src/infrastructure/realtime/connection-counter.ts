/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'

const userConnectionCounts = new Map<string, number>()

export type ConnectionRegistration =
  | { readonly accepted: true; readonly release: () => void }
  | { readonly accepted: false; readonly current: number; readonly limit: number }

export const registerConnection = (userId: string): ConnectionRegistration => {
  const limit = REALTIME_TRANSPORT_CONFIG.maxConnectionsPerUser
  const current = userConnectionCounts.get(userId) ?? 0
  if (current >= limit) {
    return { accepted: false, current, limit }
  }
  userConnectionCounts.set(userId, current + 1)
  let released = false
  return {
    accepted: true,
    release: () => {
      if (released) return
      released = true
      const remaining = (userConnectionCounts.get(userId) ?? 0) - 1
      if (remaining <= 0) {
        userConnectionCounts.delete(userId)
      } else {
        userConnectionCounts.set(userId, remaining)
      }
    },
  }
}

export const getConnectionCount = (userId: string): number => userConnectionCounts.get(userId) ?? 0

export const resetConnectionCountersForTesting = (): void => {
  userConnectionCounts.clear()
}
