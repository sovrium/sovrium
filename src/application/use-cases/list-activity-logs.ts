/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
import type { UserMetadata } from '@/application/ports/models/user-metadata'

export class ActivityLogForbiddenError extends Data.TaggedError('ActivityLogForbiddenError')<{
  readonly message: string
}> {}

export interface ListActivityLogsInput {
  readonly userId: string
}

export interface ActivityLogOutput {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  readonly tableName: string
  readonly recordId: string
  readonly user: UserMetadata | null
}

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

export const ListActivityLogs = (
  input: ListActivityLogsInput
): Effect.Effect<
  readonly ActivityLogOutput[],
  ActivityLogForbiddenError | ActivityLogDatabaseError | AuthDatabaseError,
  ActivityLogRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const authRepo = yield* AuthRepository
    const activityLogRepo = yield* ActivityLogRepository

    const role = yield* authRepo.getUserRole(input.userId)

    if (!role) {
      return yield* new ActivityLogForbiddenError({
        message: 'You do not have permission to access activity logs',
      })
    }

    if (role === 'viewer') {
      return yield* new ActivityLogForbiddenError({
        message: 'You do not have permission to access activity logs',
      })
    }

    const logs = yield* activityLogRepo.listAll()

    return logs.map(mapActivityLog)
  })

export const ListActivityLogsLayer = Layer.mergeAll(ActivityLogRepositoryLive, AuthRepositoryLive)
