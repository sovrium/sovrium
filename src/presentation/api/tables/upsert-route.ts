/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { upsertWithSideEffects } from '@/application/use-cases/tables/record-batch-orchestration'
import { recordWriteRequester } from '@/application/use-cases/tables/record-create-orchestration'
import { upsertRecordsRequestSchema } from '@/domain/models/api/tables/records'
import { upsertRecordsResponseSchema } from '@/domain/models/api/tables/tables'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import { validatedBody } from '@/presentation/api/runtime/validate-request'
import { checkViewerPermission } from './batch-permission-helpers'
import { guardUpsert } from './batch-write-guards'
import { getLinkReader } from './relationship-rules'
import { maskUnreadableUniqueConflict } from './unique-conflict-mask'
import { applyReadFiltering } from './upsert-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Handle the upsert endpoint: match each record on `fieldsToMergeOn`, update
 * the match or create the record, behind the upsert's gates.
 */
export function handleUpsert(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, upsertResponse(c, app)))
}

/** Gate, upsert and answer, as one program. */
const upsertResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const { session, tableName, userRole, userGroups } = getTableContext(c)

    // A viewer the table names in neither its create nor its update grant is
    // refused BEFORE validation; `validateUpsertRequest` decides the rest.
    const viewerCheck = checkViewerPermission(c, app, ['create', 'update'])
    if (viewerCheck) return viewerCheck

    const result = yield* validatedBody(c, upsertRecordsRequestSchema)
    if (!result.success) return result.response

    const validation = yield* guardUpsert(c, app, result.data.records, result.data.fieldsToMergeOn)
    if (!validation.success) return validation.response

    // Extract flat field objects for database layer
    const flatRecordsData = validation.strippedRecords.map((record) => record.fields)

    // Execute upsert, with a record event per row inserted or matched
    const program = upsertWithSideEffects({
      ...{ session, tableName },
      requester: recordWriteRequester(session.userId, userRole),
      userGroups,
      recordsData: flatRecordsData,
      fieldsToMergeOn: result.data.fieldsToMergeOn,
      hiddenIds: validation.hiddenIds,
      returnRecords: result.data.returnRecords,
      app,
      linkReader: getLinkReader(c),
    })

    // Apply field-level read filtering to response
    const filteredProgram = applyReadFiltering({
      program,
      app,
      tableName,
      userRole,
      userGroups,
    })

    const response = yield* respondWith(c, filteredProgram, upsertRecordsResponseSchema)
    // A matched record is the one its write updates: never a holder of the value.
    const match = { fields: result.data.fieldsToMergeOn, hiddenIds: validation.hiddenIds }
    return yield* maskUnreadableUniqueConflict(
      c,
      app,
      { written: flatRecordsData, match },
      response
    )
  })
