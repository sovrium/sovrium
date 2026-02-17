/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * User metadata embedded in activity log records
 */
export interface ActivityLogUser {
  readonly id: string
  readonly name: string
  readonly email: string
}

/**
 * Activity Log record type (port-level definition)
 *
 * Structurally compatible with the Drizzle schema inference.
 * Defined here to avoid application→infrastructure dependency.
 */
export interface ActivityLog {
  readonly id: string
  readonly createdAt: Date
  readonly userId: string | null
  readonly sessionId: string | null
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly tableId: string | null
  readonly recordId: string
  readonly changes: {
    readonly before?: Record<string, unknown>
    readonly after?: Record<string, unknown>
  } | null
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly user?: ActivityLogUser | undefined
}

/**
 * Database error for activity log operations
 */
export class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Activity Log Repository Port
 *
 * Provides type-safe database operations for activity logs.
 * Implementation lives in infrastructure layer (activity-log-repository-live.ts).
 */
export class ActivityLogRepository extends Context.Tag('ActivityLogRepository')<
  ActivityLogRepository,
  {
    readonly listAll: () => Effect.Effect<readonly ActivityLog[], ActivityLogDatabaseError>
    readonly create: (log: {
      readonly userId: string
      readonly action: 'create' | 'update' | 'delete' | 'restore'
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
