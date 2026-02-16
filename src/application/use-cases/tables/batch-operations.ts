/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  BatchRepository,
  type BatchValidationError,
} from '@/application/ports/repositories/batch-repository'
import { transformRecords, type TransformedRecord } from './utils/record-transformer'
import type { UserSession } from '@/application/ports/models/user-session'
import type { ForbiddenError, SessionContextError, ValidationError } from '@/domain/errors'
import type { BatchRestoreRecordsResponse } from '@/domain/models/api/tables'
import type { App } from '@/domain/models/app'

export function batchCreateProgram(config: {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordsData: readonly Record<string, unknown>[]
  readonly returnRecords?: boolean
  readonly app?: App
}): Effect.Effect<
  { readonly created: number; readonly records?: readonly TransformedRecord[] },
  SessionContextError | ValidationError,
  BatchRepository
> {
  const { session, tableName, recordsData, returnRecords = false, app } = config
  return Effect.gen(function* () {
    const batch = yield* BatchRepository

    // Create records in the database
    const createdRecords = yield* batch.batchCreate(session, tableName, recordsData)

    // Transform records to API format with app schema for numeric coercion
    const transformed = transformRecords(createdRecords, { app, tableName })

    // Use functional pattern to build response object
    const response: { readonly created: number; readonly records?: readonly TransformedRecord[] } =
      returnRecords
        ? {
            created: transformed.length,
            records: transformed as TransformedRecord[],
          }
        : {
            created: transformed.length,
          }

    return response
  })
}

export function batchUpdateProgram(config: {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordsData: readonly {
    readonly id: string
    readonly fields?: Record<string, unknown>
  }[]
  readonly returnRecords?: boolean
  readonly app?: App
}): Effect.Effect<
  { readonly updated: number; readonly records?: readonly TransformedRecord[] },
  SessionContextError | ValidationError,
  BatchRepository
> {
  const { session, tableName, recordsData, returnRecords = false, app } = config
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    const updatedRecords = yield* batch.batchUpdate(session, tableName, recordsData)

    // Transform records to API format with app schema for numeric coercion
    const transformed = transformRecords(updatedRecords, { app, tableName })

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
  session: Readonly<UserSession>,
  tableName: string,
  ids: readonly string[],
  permanent = false
): Effect.Effect<{ deleted: number }, SessionContextError, BatchRepository> {
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    const deletedCount = yield* batch.batchDelete(session, tableName, ids, permanent)
    return {
      deleted: deletedCount,
    }
  })
}

export function batchRestoreProgram(
  session: Readonly<UserSession>,
  tableName: string,
  ids: readonly string[]
): Effect.Effect<
  BatchRestoreRecordsResponse,
  SessionContextError | ForbiddenError,
  BatchRepository
> {
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    const restored = yield* batch.batchRestore(session, tableName, ids)
    return {
      success: true as const,
      restored,
    }
  })
}

export function upsertProgram(
  session: Readonly<UserSession>,
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
  SessionContextError | ValidationError | BatchValidationError,
  BatchRepository
> {
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    const result = yield* batch.upsert(
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
