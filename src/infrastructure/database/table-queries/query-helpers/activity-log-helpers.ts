/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { db, SessionContextError, activityLogs } from '@/infrastructure/database'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

export function logActivity(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  readonly recordId: string
  readonly changes: {
    readonly before?: Record<string, unknown>
    readonly after?: Record<string, unknown>
  }
  readonly app?: App
}): Effect.Effect<void, never> {
  const { session, tableName, action, recordId, changes, app } = config
  return Effect.ignore(
    Effect.tryPromise({
      try: async () => {
        const table = app?.tables?.find((t) => t.name === tableName)
        const tableId = table?.id ? String(table.id) : '1'

        await db.insert(activityLogs).values({
          id: crypto.randomUUID(),
          userId: session.userId,
          action,
          tableName,
          tableId,
          recordId,
          changes,
        })
      },
      catch: (error) => new SessionContextError('Failed to log activity', error),
    })
  )
}
