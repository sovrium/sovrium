/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  BatchRepository,
  type BatchValidationError,
} from '@/application/ports/repositories/tables/batch-repository'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import {
  buildCreateAuthorshipOverrides,
  createdByFieldNames,
} from '@/domain/models/app/tables/authorship-fields'
import { transformRecords, type TransformedRecord } from './record-transformer'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { NotFoundError, DatabaseError, ValidationError } from '@/domain/errors'
import type { BatchRestoreRecordsResponse } from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'

export function batchCreateProgram(config: {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordsData: readonly Record<string, unknown>[]
  readonly returnRecords?: boolean
  readonly app?: App
}): Effect.Effect<
  { readonly created: number; readonly records?: readonly TransformedRecord[] },
  DatabaseError | ValidationError,
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
  }).pipe(Effect.withSpan('tables.batch-create-program'))
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
  DatabaseError | ValidationError,
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
  }).pipe(Effect.withSpan('tables.batch-update-program'))
}

export function batchDeleteProgram(
  session: Readonly<UserSession>,
  tableName: string,
  ids: readonly string[],
  permanent = false
): Effect.Effect<{ deleted: number }, DatabaseError, BatchRepository> {
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    const deletedCount = yield* batch.batchDelete(session, tableName, ids, permanent)
    return {
      deleted: deletedCount,
    }
  }).pipe(Effect.withSpan('tables.batch-delete-program'))
}

export function batchRestoreProgram(
  session: Readonly<UserSession>,
  tableName: string,
  ids: readonly string[]
): Effect.Effect<BatchRestoreRecordsResponse, DatabaseError | NotFoundError, BatchRepository> {
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    const restored = yield* batch.batchRestore(session, tableName, ids)
    return {
      success: true as const,
      restored,
    }
  }).pipe(Effect.withSpan('tables.batch-restore-program'))
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
  DatabaseError | ValidationError | BatchValidationError,
  BatchRepository
> {
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    // Stamp every `created-by`/`updated-by`-typed field BY NAME, as the
    // single-record create does (`write-record-programs.ts`): the infra only
    // fills the literal `created_by`/`updated_by` columns, and the create half
    // of an upsert must satisfy a NOT NULL author column like any other create.
    // The created-by names, plus the intrinsic `created_at`/`created_by`, are
    // insert-only: a matched row keeps its original author and creation date.
    const tables = params.app?.tables
    const overrides = isGuestSession(session.userId)
      ? {}
      : buildCreateAuthorshipOverrides(tables, tableName, session.userId)
    const recordsData = params.recordsData.map((fields) => ({ ...fields, ...overrides }))
    const insertOnlyFields = ['created_at', 'created_by', ...createdByFieldNames(tables, tableName)]
    const result = yield* batch.upsert(session, tableName, recordsData, {
      fieldsToMergeOn: params.fieldsToMergeOn,
      insertOnlyFields,
    })

    const transformed = transformRecords(result.records, { app: params.app, tableName })
    return {
      records: transformed,
      created: result.created,
      updated: result.updated,
    }
  }).pipe(Effect.withSpan('tables.upsert-program'))
}
