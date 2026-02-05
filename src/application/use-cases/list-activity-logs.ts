/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line no-restricted-syntax -- Activity logs are a cross-cutting concern, not phase-specific
import { Data, Effect, Layer } from 'effect'
import {
  ActivityLogService,
  ActivityLogServiceLive,
  type ActivityLogDatabaseError,
} from '@/infrastructure/services/activity-log-service'
import {
  UserRoleService,
  UserRoleServiceLive,
  type UserRoleDatabaseError,
} from '@/infrastructure/services/user-role-service'
import type { ActivityLogWithUser } from '@/infrastructure/database/drizzle/schema/activity-log'

/**
 * Forbidden error when user lacks permission to access activity logs
 */
export class ForbiddenError extends Data.TaggedError('ForbiddenError')<{
  readonly message: string
}> {}

/**
 * Filters for activity logs
 */
export interface ActivityLogFilters {
  readonly action?: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName?: string
  readonly userId?: string
  readonly startDate?: string
}

/**
 * Input for ListActivityLogsWithFilters use case
 */
export interface ListActivityLogsWithFiltersInput {
  readonly userId: string
  readonly page: number
  readonly pageSize: number
  readonly filters: ActivityLogFilters
}

/**
 * User metadata in activity log
 */
export interface UserMetadata {
  readonly id: string
  readonly name: string | null
  readonly email: string
}

/**
 * Activity log output type with user metadata
 */
export interface ActivityLogWithUserOutput {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: string
  readonly user: UserMetadata | undefined
}

/**
 * Activity logs with pagination result
 */
export interface ActivityLogsWithPaginationResult {
  readonly logs: readonly ActivityLogWithUserOutput[]
  readonly total: number
}

/**
 * Map infrastructure ActivityLogWithUser to application output
 */
function mapActivityLogWithUser(log: Readonly<ActivityLogWithUser>): ActivityLogWithUserOutput {
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    userId: log.userId ?? undefined,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    user: log.user
      ? {
          id: log.user.id,
          name: log.user.name,
          email: log.user.email,
        }
      : undefined,
  }
}

/**
 * List Activity Logs with Filters and Pagination Use Case
 *
 * Application layer use case that:
 * 1. Checks user role and permissions
 * 2. Validates filter access (non-admin cannot filter by other users)
 * 3. Lists activity logs with filters and pagination
 * 4. Includes user metadata via join
 *
 * Follows layer-based architecture:
 * - Application Layer: This file (orchestration + business logic)
 * - Infrastructure Layer: ActivityLogService, UserRoleService
 * - Domain Layer: Business rules (viewer restriction, permission checks)
 */
export const ListActivityLogsWithFilters = (
  input: ListActivityLogsWithFiltersInput
): Effect.Effect<
  ActivityLogsWithPaginationResult,
  ForbiddenError | ActivityLogDatabaseError | UserRoleDatabaseError,
  ActivityLogService | UserRoleService
> =>
  Effect.gen(function* () {
    const userRoleService = yield* UserRoleService
    const activityLogService = yield* ActivityLogService

    // Get user role to enforce permissions
    const role = yield* userRoleService.getUserRole(input.userId)

    // If user has no role, deny access
    if (!role) {
      return yield* new ForbiddenError({
        message: 'You do not have permission to access activity logs',
      })
    }

    // Domain rule: Viewers cannot access activity logs
    if (role === 'viewer') {
      return yield* new ForbiddenError({
        message: 'You do not have permission to access activity logs',
      })
    }

    // Domain rule: Non-admin users can only filter by their own userId
    if (input.filters.userId && input.filters.userId !== input.userId && role !== 'admin') {
      return yield* new ForbiddenError({
        message: 'You do not have permission to view other users activity logs',
      })
    }

    // List activity logs with filters and pagination
    const result = yield* activityLogService.listWithFilters({
      page: input.page,
      pageSize: input.pageSize,
      action: input.filters.action,
      tableName: input.filters.tableName,
      userId: input.filters.userId,
      startDate: input.filters.startDate,
    })

    // Map to presentation-friendly format
    return {
      logs: result.logs.map(mapActivityLogWithUser),
      total: result.total,
    }
  })

/**
 * Application Layer for Activity Logs
 *
 * Combines all services needed for activity log use cases.
 */
export const ListActivityLogsLayer = Layer.mergeAll(ActivityLogServiceLive, UserRoleServiceLive)
