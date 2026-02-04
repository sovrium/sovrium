/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  batchCreateRecords,
  batchRestoreRecords,
  batchUpdateRecords,
  batchDeleteRecords,
  upsertRecords,
  type BatchValidationError,
} from '@/infrastructure/database/table-queries'
import { transformRecords, type TransformedRecord } from './utils/record-transformer'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type {
  ForbiddenError,
  SessionContextError,
  ValidationError,
} from '@/infrastructure/database/session-context'
import type { BatchRestoreRecordsResponse } from '@/presentation/api/schemas/tables-schemas'

export function batchCreateProgram(
  session: Readonly<Session>,
  tableName: string,
  recordsData: readonly Record<string, unknown>[]
) {
  return Effect.gen(function* () {
    // Create records in the database
    const createdRecords = yield* batchCreateRecords(session, tableName, recordsData)

    // Transform records to API format
    const transformed = transformRecords(createdRecords)

    return {
      records: transformed,
      count: transformed.length,
    }
  })
}

export function batchUpdateProgram(
  session: Readonly<Session>,
  tableName: string,
  recordsData: readonly { readonly id: string; readonly fields?: Record<string, unknown> }[],
  returnRecords: boolean = false
): Effect.Effect<
  { readonly updated: number; readonly records?: readonly TransformedRecord[] },
  SessionContextError | ValidationError
> {
  return Effect.gen(function* () {
    const updatedRecords = yield* batchUpdateRecords(session, tableName, recordsData)

    // Transform records to API format (nested fields structure)
    const transformed = transformRecords(updatedRecords)

    // Use functional pattern to build response object
    const response: { readonly updated: number; readonly records?: readonly TransformedRecord[] } =
      returnRecords
        ? {
            updated: transformed.length,
            records: transformed as TransformedRecord[],
          }
        : {
            updated: transformed.length,
          }

    return response
  })
}

export function batchDeleteProgram(
  session: Readonly<Session>,
  tableName: string,
  ids: readonly string[],
  permanent = false
): Effect.Effect<{ deleted: number }, SessionContextError> {
  return Effect.gen(function* () {
    const deletedCount = yield* batchDeleteRecords(session, tableName, ids, permanent)
    return {
      deleted: deletedCount,
    }
  })
}

export function batchRestoreProgram(
  session: Readonly<Session>,
  tableName: string,
  ids: readonly string[]
): Effect.Effect<BatchRestoreRecordsResponse, SessionContextError | ForbiddenError> {
  return Effect.gen(function* () {
    const restored = yield* batchRestoreRecords(session, tableName, ids)
    return {
      success: true as const,
      restored,
    }
  })
}

export function upsertProgram(
  session: Readonly<Session>,
  tableName: string,
  params: {
    readonly recordsData: readonly Record<string, unknown>[]
    readonly fieldsToMergeOn: readonly string[]
    readonly returnRecords: boolean
    readonly app?: App
  }
): Effect.Effect<
  {
    readonly records: readonly TransformedRecord[]
    readonly created: number
    readonly updated: number
  },
  SessionContextError | ValidationError | BatchValidationError
> {
  return Effect.gen(function* () {
    const result = yield* upsertRecords(
      session,
      tableName,
      params.recordsData,
      params.fieldsToMergeOn
    )

    const transformed = transformRecords(result.records, { app: params.app, tableName })
    return {
      records: transformed,
      created: result.created,
      updated: result.updated,
    }
  })
}
