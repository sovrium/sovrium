/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc } from 'drizzle-orm'
import { Context, Data, Effect, Layer } from 'effect'
import { db } from '@/infrastructure/database'
import {
  activityLogs,
  type ActivityLog,
} from '@/infrastructure/database/drizzle/schema/activity-log'

/**
 * Database error for activity log operations
 */
export class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Activity Log Service
 *
 * Provides type-safe database operations for activity logs using Drizzle ORM.
 * Follows Sovrium patterns:
 * - Effect.ts for functional programming
 * - Drizzle ORM query builder (NO raw SQL)
 * - Context/Layer for dependency injection
 */
export class ActivityLogService extends Context.Tag('ActivityLogService')<
  ActivityLogService,
  {
    readonly listAll: () => Effect.Effect<readonly ActivityLog[], ActivityLogDatabaseError>
  }
>() {}

/**
 * Activity Log Service Implementation
 *
 * Uses Drizzle ORM query builder for type-safe, SQL-injection-proof queries.
 */
export const ActivityLogServiceLive = Layer.succeed(ActivityLogService, {
  /**
   * List all activity logs
   */
  listAll: () =>
    Effect.tryPromise({
      try: () => db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)),
      catch: (error) => new ActivityLogDatabaseError({ cause: error }),
    }),
})
