/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { UserMetadataWithImage } from '@/application/ports/contracts/user-metadata'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DatabaseError } from '@/domain/errors'
import type { Effect } from 'effect'

/**
 * Activity log with user metadata
 */
export interface ActivityLogWithUser {
  readonly id: string
  readonly userId: string
  readonly action: string
  readonly tableName: string
  /** The record id as the records API names it — the text the log stores. */
  readonly recordId: string
  readonly changes: Record<string, unknown> | null
  readonly createdAt: Date
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
  }
}

/**
 * Database error for activity queries
 */
export class ActivityDatabaseError {
  readonly _tag = 'ActivityDatabaseError'
  constructor(readonly cause: unknown) {}
}

/**
 * Activity not found error
 */
export class ActivityNotFoundError {
  readonly _tag = 'ActivityNotFoundError'
  constructor(readonly activityId: string) {}
}

/**
 * Activity history entry with user metadata
 */
export interface ActivityHistoryEntry {
  readonly action: string
  readonly createdAt: Date
  readonly changes: unknown
  readonly user: UserMetadataWithImage | undefined
}

/**
 * Activity Repository Port
 */
export class ActivityRepository extends Context.Service<
  ActivityRepository,
  {
    readonly getRecordHistory: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly recordId: string
      readonly limit?: number
      readonly offset?: number
    }) => Effect.Effect<
      {
        readonly entries: readonly ActivityHistoryEntry[]
        readonly total: number
      },
      DatabaseError
    >
    readonly checkRecordExists: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly recordId: string
    }) => Effect.Effect<boolean, DatabaseError>
    /** One audit-log entry by id, joined to its author's name and email. */
    readonly getActivityById: (
      activityId: string
    ) => Effect.Effect<ActivityLogWithUser, ActivityNotFoundError | ActivityDatabaseError>
  }
>()('ActivityRepository') {}
