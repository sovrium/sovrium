/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { NotificationRepository } from '@/application/ports/repositories/notification-repository'
import type { NotificationDatabaseError } from '@/application/ports/repositories/notification-repository'


export interface ListInboxInput {
  readonly userId: string
  readonly status?: string
  readonly limit?: number
  readonly offset: number
}

export interface ListInboxResult {
  readonly notifications: readonly Record<string, unknown>[]
  readonly total: number
  readonly limit: number | undefined
  readonly offset: number
}

const filterByStatus = (
  rows: readonly Record<string, unknown>[],
  status: string | undefined
): readonly Record<string, unknown>[] => {
  if (status === 'unread') return rows.filter((row) => row['read'] === false)
  if (status === 'read') return rows.filter((row) => row['read'] === true)
  return rows
}

export const listInbox = (
  input: ListInboxInput
): Effect.Effect<ListInboxResult, NotificationDatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository
    const all = yield* repo.findByUser(input.userId)
    const filtered = filterByStatus(all, input.status)
    const end =
      input.limit !== undefined && input.limit > 0 ? input.offset + input.limit : filtered.length
    return {
      notifications: filtered.slice(input.offset, end),
      total: filtered.length,
      limit: input.limit,
      offset: input.offset,
    }
  })
