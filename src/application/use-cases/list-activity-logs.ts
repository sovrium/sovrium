/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line no-restricted-syntax -- Activity logs are a cross-cutting concern, not phase-specific
import { Effect } from 'effect'
import {
  ActivityLogRepository,
  type ActivityLog,
  type ActivityLogDatabaseError,
  type ActivityLogPageQuery,
  type LiveRecordsQuery,
} from '@/application/ports/repositories/analytics/activity-log-repository'
import type { UserMetadata } from '@/application/ports/contracts/user-metadata'

/**
 * Activity log output type for presentation layer
 *
 * Decouples presentation from infrastructure database schema.
 * user is null for system-logged activities (no user_id).
 */
export interface ActivityLogOutput {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  readonly tableName: string
  readonly recordId: string
  readonly user: UserMetadata | null
}

/**
 * Map infrastructure ActivityLog to application output
 */
function mapActivityLog(log: Readonly<ActivityLog>): ActivityLogOutput {
  const user = log.user != null ? log.user : null
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    userId: log.userId ?? undefined,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    user,
  }
}

/**
 * List Activity Logs Use Case
 *
 * One page of the activity of the last year, mapped to a presentation-friendly
 * format, with the count of every entry the query admits. Who reads which
 * entry is not decided here: the route resolves, once per table, what the
 * records API lets the caller read (`query.admission`), and the repository
 * selects, pages and counts only those entries in the database.
 */
export const ListActivityLogs = (
  query: ActivityLogPageQuery
): Effect.Effect<
  { readonly activities: readonly ActivityLogOutput[]; readonly total: number },
  ActivityLogDatabaseError,
  ActivityLogRepository
> =>
  Effect.gen(function* () {
    const activityLogRepo = yield* ActivityLogRepository
    const page = yield* activityLogRepo.listPage(query)
    return { activities: page.rows.map(mapActivityLog), total: page.total }
  }).pipe(Effect.withSpan('list-activity-logs.list-activity-logs'))

/**
 * The live rows of one table an activity gate judges in memory, read in one
 * statement — the records the activity log names for the table, or the ones
 * listed.
 */
export const ListActivityGateRecords = (
  query: LiveRecordsQuery
): Effect.Effect<
  readonly Readonly<Record<string, unknown>>[],
  ActivityLogDatabaseError,
  ActivityLogRepository
> =>
  Effect.gen(function* () {
    const activityLogRepo = yield* ActivityLogRepository
    return yield* activityLogRepo.liveRecords(query)
  }).pipe(
    Effect.withSpan('list-activity-logs.list-activity-gate-records', {
      attributes: { 'table.name': query.tableName },
    })
  )
