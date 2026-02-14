/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable no-restricted-syntax -- Use case organization into subdirectories is optional, keeping flat structure for now */

import { Data, Effect, Layer } from 'effect'
import { TableRepository } from '@/application/ports/table-repository'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import {
  ActivityLogService,
  ActivityLogServiceLive,
  type ActivityLogDatabaseError,
  type ActivityLogWithUser,
} from '@/infrastructure/services/activity-log-service'
import type { SessionContextError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

/**
 * Table not found error
 */
export class TableNotFoundError extends Data.TaggedError('TableNotFoundError')<{
  readonly message: string
}> {}

/**
 * Record not found error (no history exists for this record)
 */
export class RecordNotFoundError extends Data.TaggedError('RecordNotFoundError')<{
  readonly message: string
}> {}

/**
 * Input for GetRecordHistory use case
 */
export interface GetRecordHistoryInput {
  readonly tableId: number
  readonly recordId: string
  readonly limit?: number
  readonly offset?: number
  readonly app: App
  readonly userId: string
}

/**
 * Activity history item for presentation layer
 */
export interface ActivityHistoryItem {
  readonly id: string
  readonly createdAt: string
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly changes: Record<string, unknown> | null
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
  } | null
}

/**
 * Paginated activity history output
 */
export interface ActivityHistoryOutput {
  readonly history: readonly ActivityHistoryItem[]
  readonly pagination: {
    readonly limit: number
    readonly offset: number
    readonly total: number
  }
}

/**
 * Map ActivityLogWithUser to presentation format
 */
function mapToHistoryItem(log: Readonly<ActivityLogWithUser>): ActivityHistoryItem {
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    action: log.action,
    changes: log.changes as Record<string, unknown> | null,
    user: log.user,
  }
}

/**
 * Validate that table exists in app schema
 */
function validateTable(
  app: App,
  tableId: number
): Effect.Effect<{ name: string }, TableNotFoundError> {
  const table = app.tables?.find((t) => t.id === tableId)
  if (!table) {
    return Effect.fail(
      new TableNotFoundError({
        message: `Table with ID ${tableId} not found`,
      })
    )
  }
  return Effect.succeed({ name: table.name })
}

/**
 * Check if record exists when no activity logs are found
 */
function checkRecordExistence(
  tableName: string,
  recordId: string,
  userId: string
): Effect.Effect<void, RecordNotFoundError | SessionContextError, TableRepository> {
  /* eslint-disable unicorn/no-null -- UserSession interface requires null for nullable fields */
  const session = {
    id: '',
    userId,
    token: '',
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
    impersonatedBy: null,
  }
  /* eslint-enable unicorn/no-null */

  return Effect.gen(function* () {
    const tableRepository = yield* TableRepository

    const record = yield* tableRepository.getRecord(
      session,
      tableName,
      recordId,
      true // includeDeleted: check both active and deleted records
    )

    if (!record) {
      return yield* new RecordNotFoundError({
        message: `Record with ID ${recordId} not found`,
      })
    }
  })
}

/**
 * Get Record History Use Case
 *
 * Application layer use case that:
 * 1. Validates table exists in app schema
 * 2. Checks if record exists in the table (returns 404 if never existed)
 * 3. Fetches activity logs for the record with pagination
 * 4. Maps to presentation-friendly format
 *
 * Record existence logic:
 * - Record never existed (not in table, no activity) → 404 RecordNotFoundError
 * - Record exists but has no activity → 200 with empty history
 * - Record has activity (even if deleted) → 200 with history
 *
 * Follows layer-based architecture:
 * - Application Layer: This file (orchestration + business logic)
 * - Infrastructure Layer: ActivityLogService, TableRepository
 * - Domain Layer: App schema validation
 */
export const GetRecordHistory = (
  input: GetRecordHistoryInput
): Effect.Effect<
  ActivityHistoryOutput,
  TableNotFoundError | RecordNotFoundError | ActivityLogDatabaseError | SessionContextError,
  ActivityLogService | TableRepository
> =>
  Effect.gen(function* () {
    const activityLogService = yield* ActivityLogService

    // Validate table exists
    const table = yield* validateTable(input.app, input.tableId)

    // Fetch activity logs
    const result = yield* activityLogService.getRecordHistory({
      tableName: table.name,
      recordId: input.recordId,
      limit: input.limit,
      offset: input.offset,
    })

    // If no activity, verify record exists
    if (result.total === 0) {
      yield* checkRecordExistence(table.name, input.recordId, input.userId)
    }

    // Map to presentation format
    const history = result.logs.map(mapToHistoryItem)

    return {
      history,
      pagination: {
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
        total: result.total,
      },
    }
  })

/**
 * Application Layer for Get Record History
 *
 * Provides all services needed for record history use case.
 * Merges ActivityLogService and TableRepository layers.
 */
export const GetRecordHistoryLayer = Layer.merge(ActivityLogServiceLive, TableLive)
