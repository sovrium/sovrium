/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { UserMetadata } from '@/application/ports/models/user-metadata'
import type { Effect } from 'effect'

export interface ActivityLog {
  readonly id: string
  readonly createdAt: Date
  readonly userId: string | null
  readonly sessionId: string | null
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  readonly tableName: string
  readonly tableId: string | null
  readonly recordId: string
  readonly changes: {
    readonly before?: Record<string, unknown>
    readonly after?: Record<string, unknown>
  } | null
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly user?: UserMetadata | null | undefined
}

export class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
  readonly cause: unknown
}> {}

export class ActivityLogRepository extends Context.Tag('ActivityLogRepository')<
  ActivityLogRepository,
  {
    readonly listAll: () => Effect.Effect<readonly ActivityLog[], ActivityLogDatabaseError>
    readonly create: (log: {
      readonly userId: string
      readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
      readonly tableName: string
      readonly tableId: string
      readonly recordId: string
      readonly changes: {
        readonly before?: Record<string, unknown>
        readonly after?: Record<string, unknown>
      }
      readonly sessionId?: string
      readonly ipAddress?: string
      readonly userAgent?: string
    }) => Effect.Effect<ActivityLog, ActivityLogDatabaseError>
  }
>() {}
