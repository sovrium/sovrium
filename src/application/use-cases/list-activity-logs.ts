/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line no-restricted-syntax -- Activity logs are a cross-cutting concern, not phase-specific
import { Data, Effect, Layer } from 'effect'
import {
  ActivityLogRepository,
  type ActivityLog,
  type ActivityLogDatabaseError,
} from '@/application/ports/repositories/activity-log-repository'
import {
  AuthRepository,
  type AuthDatabaseError,
} from '@/application/ports/repositories/auth-repository'
import { ActivityLogRepositoryLive } from '@/infrastructure/database/repositories/activity-log-repository-live'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth-repository-live'

/**
 * Forbidden error when user lacks permission to access activity logs
 */
export class ForbiddenError extends Data.TaggedError('ForbiddenError')<{
  readonly message: string
}> {}

/**
 * Input for ListActivityLogs use case
 */
export interface ListActivityLogsInput {
  readonly userId: string
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
}

/**
 * Map infrastructure ActivityLog to application output
 */
function mapActivityLog(log: Readonly<ActivityLog>): ActivityLogOutput {
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    userId: log.userId ?? undefined,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
  }
}

/**
 * List Activity Logs Use Case
 *
 * Application layer use case that:
 * 1. Checks user role (viewers are forbidden)
 * 2. Lists activity logs
 * 3. Maps to presentation-friendly format
 *
 * Follows layer-based architecture:
 * - Application Layer: This file (orchestration + business logic)
 * - Infrastructure Layer: ActivityLogRepository, UserRoleRepository
 * - Domain Layer: Business rules (viewer restriction)
 */
export const ListActivityLogs = (
  input: ListActivityLogsInput
): Effect.Effect<
  readonly ActivityLogOutput[],
  ForbiddenError | ActivityLogDatabaseError | AuthDatabaseError,
  ActivityLogRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const authRepo = yield* AuthRepository
    const activityLogRepo = yield* ActivityLogRepository

    // Get user role to enforce permissions
    const role = yield* authRepo.getUserRole(input.userId)

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

    // List all activity logs
    const logs = yield* activityLogRepo.listAll()

    // Map to presentation-friendly format
    return logs.map(mapActivityLog)
  })

/**
 * Application Layer for Activity Logs
 *
 * Combines all services needed for activity log use cases.
 */
export const ListActivityLogsLayer = Layer.mergeAll(ActivityLogRepositoryLive, AuthRepositoryLive)
