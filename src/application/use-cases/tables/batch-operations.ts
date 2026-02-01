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
} from '@/infrastructure/database/table-queries'
import { transformRecords, type TransformedRecord } from './utils/record-transformer'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { ForbiddenError, SessionContextError } from '@/infrastructure/database/session-context'
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
  recordsData: readonly { id: string; [key: string]: unknown }[]
): Effect.Effect<
  { readonly records: readonly TransformedRecord[]; readonly count: number },
  SessionContextError
> {
  return Effect.gen(function* () {
    const updatedRecords = yield* batchUpdateRecords(session, tableName, recordsData)

    // Transform records to API format (nested fields structure)
    const transformed = transformRecords(updatedRecords)

    return {
      records: transformed as TransformedRecord[],
      count: transformed.length,
    }
  })
}

export function batchDeleteProgram(
  session: Readonly<Session>,
  tableName: string,
  ids: readonly string[]
): Effect.Effect<
  { success: true; count: number; deletedIds: readonly string[] },
  SessionContextError
> {
  return Effect.gen(function* () {
    const deletedCount = yield* batchDeleteRecords(session, tableName, ids)
    return {
      success: true as const,
      count: deletedCount,
      deletedIds: ids,
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
  recordsData: readonly Record<string, unknown>[],
  fieldsToMergeOn: readonly string[],
  returnRecords: boolean
): Effect.Effect<
  {
    readonly records?: readonly TransformedRecord[]
    readonly created: number
    readonly updated: number
  },
  SessionContextError
> {
  return Effect.gen(function* () {
    const result = yield* upsertRecords(session, tableName, recordsData, fieldsToMergeOn)

    if (returnRecords) {
      const transformed = transformRecords(result.records)
      return {
        records: transformed,
        created: result.created,
        updated: result.updated,
      }
    }

    return {
      created: result.created,
      updated: result.updated,
    }
  })
}
