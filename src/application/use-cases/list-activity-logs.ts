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

/**
 * Forbidden error when user lacks permission to access activity logs
 */
export class ForbiddenError extends Data.TaggedError('ForbiddenError')<{
  readonly message: string
}> {}

/**
 * Validation error for invalid query parameters
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string
}> {}

/**
 * Input for ListActivityLogs use case
 */
export interface ListActivityLogsInput {
  readonly userId: string
  readonly page?: number
  readonly pageSize?: number
  readonly tableName?: string
  readonly action?: 'create' | 'update' | 'delete' | 'restore'
  readonly filterUserId?: string
  readonly startDate?: string
}

/**
 * Activity log output type for presentation layer
 *
 * Decouples presentation from infrastructure database schema.
 */
export interface ActivityLogOutput {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: string
  readonly changes: unknown
  readonly user:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
      }
    | undefined
}

/**
 * Paginated activity logs response
 */
export interface PaginatedActivityLogsOutput {
  readonly activities: readonly ActivityLogOutput[]
  readonly pagination: {
    readonly page: number
    readonly pageSize: number
    readonly total: number
    readonly totalPages: number
  }
}

/**
 * Validate pagination parameters
 */
function validatePaginationParams(
  page: number,
  pageSize: number
): Effect.Effect<void, ValidationError> {
  if (page < 1) {
    return Effect.fail(new ValidationError({ message: 'Page must be at least 1' }))
  }
  if (pageSize > 100) {
    return Effect.fail(new ValidationError({ message: 'Page size cannot exceed 100' }))
  }
  return Effect.void
}

/**
 * Validate action parameter
 */
function validateAction(action: string | undefined): Effect.Effect<void, ValidationError> {
  if (action && !['create', 'update', 'delete', 'restore'].includes(action)) {
    return Effect.fail(
      new ValidationError({
        message: 'Action must be one of: create, update, delete, restore',
      })
    )
  }
  return Effect.void
}

/**
 * Check user role permissions for activity logs
 */
function checkRolePermissions(
  role: string | null | undefined,
  userId: string,
  filterUserId: string | undefined
): Effect.Effect<void, ForbiddenError> {
  if (!role) {
    return Effect.fail(
      new ForbiddenError({
        message: 'You do not have permission to access activity logs',
      })
    )
  }

  if (role === 'viewer') {
    return Effect.fail(
      new ForbiddenError({
        message: 'You do not have permission to access activity logs',
      })
    )
  }

  if (filterUserId && filterUserId !== userId && role !== 'admin') {
    return Effect.fail(
      new ForbiddenError({
        message: 'You can only view your own activity logs',
      })
    )
  }

  return Effect.void
}

/**
 * Map activity log to presentation format
 */
function mapActivityLogToOutput(log: {
  readonly id: string
  readonly createdAt: Date
  readonly userId: string | null
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: string
  readonly changes: unknown
  readonly user:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
      }
    | undefined
}): ActivityLogOutput {
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    userId: log.userId ?? undefined,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    changes: log.changes,
    user: log.user,
  }
}

/**
 * List Activity Logs Use Case
 *
 * Application layer use case that:
 * 1. Validates query parameters
 * 2. Checks user role (viewers are forbidden)
 * 3. Enforces userId filter permissions (non-admin can only filter by own userId)
 * 4. Lists activity logs with filters
 * 5. Maps to presentation-friendly format with pagination
 *
 * Follows layer-based architecture:
 * - Application Layer: This file (orchestration + business logic)
 * - Infrastructure Layer: ActivityLogService, UserRoleService
 * - Domain Layer: Business rules (viewer restriction, userId filter permissions)
 */
export const ListActivityLogs = (
  input: ListActivityLogsInput
): Effect.Effect<
  PaginatedActivityLogsOutput,
  ForbiddenError | ValidationError | ActivityLogDatabaseError | UserRoleDatabaseError,
  ActivityLogService | UserRoleService
> =>
  Effect.gen(function* () {
    const userRoleService = yield* UserRoleService
    const activityLogService = yield* ActivityLogService

    const page = input.page ?? 1
    const pageSize = input.pageSize ?? 50

    yield* validatePaginationParams(page, pageSize)
    yield* validateAction(input.action)

    const role = yield* userRoleService.getUserRole(input.userId)
    yield* checkRolePermissions(role, input.userId, input.filterUserId)

    const result = yield* activityLogService.listWithFilters({
      page,
      pageSize,
      tableName: input.tableName,
      action: input.action,
      userId: input.filterUserId,
      startDate: input.startDate,
    })

    const activities = result.logs.map(mapActivityLogToOutput)
    const totalPages = Math.ceil(result.total / pageSize)

    return {
      activities,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages,
      },
    }
  })

/**
 * Application Layer for Activity Logs
 *
 * Combines all services needed for activity log use cases.
 */
export const ListActivityLogsLayer = Layer.mergeAll(ActivityLogServiceLive, UserRoleServiceLive)
