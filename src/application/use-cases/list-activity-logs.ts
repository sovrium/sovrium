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

    // Validate query parameters
    const page = input.page ?? 1
    const pageSize = input.pageSize ?? 50

    if (page < 1) {
      return yield* new ValidationError({ message: 'Page must be at least 1' })
    }

    if (pageSize > 100) {
      return yield* new ValidationError({ message: 'Page size cannot exceed 100' })
    }

    if (input.action && !['create', 'update', 'delete', 'restore'].includes(input.action)) {
      return yield* new ValidationError({
        message: 'Action must be one of: create, update, delete, restore',
      })
    }

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
    if (input.filterUserId && input.filterUserId !== input.userId && role !== 'admin') {
      return yield* new ForbiddenError({
        message: 'You can only view your own activity logs',
      })
    }

    // List activity logs with filters
    const result = yield* activityLogService.listWithFilters({
      page,
      pageSize,
      tableName: input.tableName,
      action: input.action,
      userId: input.filterUserId,
      startDate: input.startDate,
    })

    // Map to presentation-friendly format
    const activities = result.logs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      userId: log.userId ?? undefined,
      action: log.action,
      tableName: log.tableName,
      recordId: log.recordId,
      changes: log.changes,
      user: log.user,
    }))

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
