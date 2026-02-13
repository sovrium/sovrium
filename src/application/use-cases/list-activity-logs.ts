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
  type ActivityLogWithUser,
} from '@/infrastructure/services/activity-log-service'
import {
  UserRoleService,
  UserRoleServiceLive,
  type UserRoleDatabaseError,
} from '@/infrastructure/services/user-role-service'
import type { ActivityAction } from '@/infrastructure/database/drizzle/schema/activity-log'

/**
 * Valid activity action types
 */
const VALID_ACTIONS: readonly ActivityAction[] = ['create', 'update', 'delete', 'restore'] as const

/**
 * Forbidden error when user lacks permission to access activity logs
 */
export class ForbiddenError extends Data.TaggedError('ForbiddenError')<{
  readonly message: string
}> {}

/**
 * Validation error for invalid input parameters
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string
}> {}

/**
 * Input for ListActivityLogs use case
 */
export interface ListActivityLogsInput {
  readonly userId: string
  readonly tableName?: string
  readonly action?: ActivityAction
  readonly filterUserId?: string
  readonly startDate?: string
  readonly endDate?: string
  readonly page?: number
  readonly pageSize?: number
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
  readonly user: {
    readonly id: string
    readonly email: string
    readonly name: string
  } | null
}

/**
 * Paginated response for activity logs
 */
export interface ActivityLogsResponse {
  readonly activities: readonly ActivityLogOutput[]
  readonly pagination: {
    readonly page: number
    readonly pageSize: number
    readonly total: number
    readonly totalPages: number
  }
}

/**
 * Map infrastructure ActivityLogWithUser to application output
 */
function mapActivityLog(log: Readonly<ActivityLogWithUser>): ActivityLogOutput {
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    userId: log.userId ?? undefined,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    user: log.user,
  }
}

/**
 * List Activity Logs Use Case
 *
 * Application layer use case that:
 * 1. Validates input parameters
 * 2. Checks user role (viewers are forbidden)
 * 3. Enforces permission rules for userId filtering
 * 4. Lists activity logs with filtering and pagination
 * 5. Maps to presentation-friendly format
 *
 * Follows layer-based architecture:
 * - Application Layer: This file (orchestration + business logic)
 * - Infrastructure Layer: ActivityLogService, UserRoleService
 * - Domain Layer: Business rules (viewer restriction, permission checks)
 */
// eslint-disable-next-line max-lines-per-function -- Comprehensive business logic with validation, permission checks, and data transformation
export const ListActivityLogs = (
  input: ListActivityLogsInput
): Effect.Effect<
  ActivityLogsResponse,
  ForbiddenError | ValidationError | ActivityLogDatabaseError | UserRoleDatabaseError,
  ActivityLogService | UserRoleService
> =>
  // eslint-disable-next-line max-lines-per-function, max-statements, complexity -- Orchestrates multiple validation steps, permission checks, and data mapping
  Effect.gen(function* () {
    const userRoleService = yield* UserRoleService
    const activityLogService = yield* ActivityLogService

    // Validate pagination parameters
    const page = input.page ?? 1
    const pageSize = input.pageSize ?? 50

    if (page < 1) {
      return yield* new ValidationError({
        message: 'Page must be greater than or equal to 1',
      })
    }

    if (pageSize < 1 || pageSize > 100) {
      return yield* new ValidationError({
        message: 'Page size must be between 1 and 100',
      })
    }

    // Validate action filter
    if (input.action && !VALID_ACTIONS.includes(input.action)) {
      return yield* new ValidationError({
        message: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
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

    // Permission check: Non-admin users can only filter by their own userId
    if (input.filterUserId && input.filterUserId !== input.userId && role !== 'admin') {
      return yield* new ForbiddenError({
        message: 'You can only view your own activity logs',
      })
    }

    // Parse date filters
    const startDate = input.startDate ? new Date(input.startDate) : undefined
    const endDate = input.endDate ? new Date(input.endDate) : undefined

    // List activity logs with filters
    const result = yield* activityLogService.list({
      tableName: input.tableName,
      action: input.action,
      userId: input.filterUserId,
      startDate,
      endDate,
      page,
      pageSize,
    })

    // Calculate total pages
    const totalPages = Math.ceil(result.total / pageSize)

    // Map to presentation-friendly format
    return {
      activities: result.activities.map(mapActivityLog),
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
