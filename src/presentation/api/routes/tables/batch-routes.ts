/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  hasCreatePermission,
  hasUpdatePermission,
  hasDeletePermission,
} from '@/application/use-cases/tables/permissions/permissions'
import {
  batchCreateProgram,
  batchUpdateProgram,
  batchDeleteProgram,
  batchRestoreProgram,
  upsertProgram,
} from '@/application/use-cases/tables/programs'
import {
  batchCreateRecordsRequestSchema,
  batchUpdateRecordsRequestSchema,
  batchDeleteRecordsRequestSchema,
  batchRestoreRecordsRequestSchema,
  upsertRecordsRequestSchema,
} from '@/domain/models/api/tables/records'
import {
  batchCreateRecordsResponseSchema,
  batchUpdateRecordsResponseSchema,
  batchDeleteRecordsResponseSchema,
  upsertRecordsResponseSchema,
} from '@/domain/models/api/tables/tables'
import { runTableProgram, provideTableLive } from '@/infrastructure/layers/table-layer'
import { runEffect } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { validateRequest } from '@/presentation/api/utils/validate-request'
import {
  checkViewerPermission,
  checkRecordLimitExceeded,
  applyBatchReadFiltering,
  checkBatchFieldPermissions,
  validateStrippedRecordsNotEmpty,
} from './batch-permission-helpers'
import { forbiddenCreateResponse } from './response-helpers'
import {
  enforceBulkCreateGate,
  enforceBulkMutationGate,
  resolveGuardForTable,
} from './row-level-guard'
import {
  validateReadonlyFields,
  validateUpsertRequest,
  applyReadFiltering,
  stripUnwritableFields,
} from './upsert-helpers'
import { handleBatchRestoreError } from './utils'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'


async function handleBatchRestore(c: Context, _app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  if (userRole === 'viewer') {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  const body = await c.req.json()
  if (body.ids && body.ids.length > 1000) {
    return c.json(
      {
        success: false,
        message: 'Batch size exceeds maximum of 1000 records',
        code: 'PAYLOAD_TOO_LARGE',
      },
      413
    )
  }

  const result = await validateRequest(c, batchRestoreRecordsRequestSchema)
  if (!result.success) return result.response

  const programResult = await runTableProgram(
    batchRestoreProgram(session, tableName, result.data.ids)
  )

  if (programResult._tag === 'Left') {
    return handleBatchRestoreError(c, programResult.left)
  }

  return c.json(programResult.right, 200)
}

async function resolveBatchMutationAuth(input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly table: ReturnType<NonNullable<App['tables']>['find']>
  readonly ids: readonly string[]
  readonly op: 'write' | 'delete'
  readonly canonicalCheck: () => boolean
  readonly forbiddenAction: 'update' | 'delete'
}): Promise<Response | undefined> {
  const { c, tableName, userRole, session, table, ids, op, canonicalCheck } = input
  const guard = await resolveGuardForTable(session, userRole, table)

  if (guard) {
    return enforceBulkMutationGate({
      c,
      table,
      session,
      tableName,
      ids,
      guard,
      op,
    })
  }
  if (!canonicalCheck()) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }
  return undefined
}

async function resolveBatchCreateAuth(input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly records: readonly { readonly fields: Record<string, unknown> }[]
}): Promise<Response | undefined> {
  const { c, app, tableName, userRole, session, records } = input
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table)

  if (guard) {
    return enforceBulkCreateGate({
      c,
      table,
      guard,
      records: records.map((r) => r.fields),
    })
  }
  if (!hasCreatePermission(table, userRole)) {
    return forbiddenCreateResponse(c)
  }
  return undefined
}

async function handleBatchCreate(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const viewerCheck = checkViewerPermission(userRole, c)
  if (viewerCheck) return viewerCheck

  const body = await c.req.json()
  const recordLimitCheck = checkRecordLimitExceeded(body.records || [], c)
  if (recordLimitCheck) return recordLimitCheck

  const result = await validateRequest(c, batchCreateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  const authError = await resolveBatchCreateAuth({
    c,
    app,
    tableName,
    userRole,
    session,
    records: result.data.records,
  })
  if (authError) return authError

  const fieldPermCheck = checkBatchFieldPermissions({
    records: result.data.records,
    app,
    tableName,
    userRole,
    c,
  })
  if (fieldPermCheck) return fieldPermCheck

  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  const flatRecordsData = result.data.records.map((record) => record.fields)

  const program = batchCreateProgram({
    session,
    tableName,
    recordsData: flatRecordsData,
    returnRecords: result.data.returnRecords,
    app,
  })

  const filteredProgram = program.pipe(
    Effect.map((response) =>
      applyBatchReadFiltering(response, { app, tableName, userRole }, 'created')
    )
  )

  return runEffect(c, provideTableLive(filteredProgram), batchCreateRecordsResponseSchema, 201)
}

async function handleBatchUpdate(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const viewerCheck = checkViewerPermission(userRole, c)
  if (viewerCheck) return viewerCheck

  const result = await validateRequest(c, batchUpdateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  const authError = await resolveBatchMutationAuth({
    c,
    app,
    tableName,
    userRole,
    session,
    table,
    ids: result.data.records.map((r) => r.id),
    op: 'write',
    canonicalCheck: () => hasUpdatePermission(table, userRole, app.tables),
    forbiddenAction: 'update',
  })
  if (authError) return authError

  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  const strippedRecords = stripUnwritableFields(app, tableName, userRole, result.data.records)

  const strippedValidation = validateStrippedRecordsNotEmpty({
    strippedRecords,
    originalRecords: result.data.records,
    app,
    tableName,
    userRole,
    c,
  })
  if (strippedValidation) return strippedValidation

  const recordsData = strippedRecords.map((record) => ({
    id: record.id,
    fields: record.fields,
  }))

  const filteredProgram = batchUpdateProgram({
    session,
    tableName,
    recordsData,
    returnRecords: result.data.returnRecords,
    app,
  }).pipe(
    Effect.map((response) =>
      applyBatchReadFiltering(response, { app, tableName, userRole }, 'updated')
    )
  )

  return runEffect(c, provideTableLive(filteredProgram), batchUpdateRecordsResponseSchema)
}

async function handleBatchDelete(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const viewerCheck = checkViewerPermission(userRole, c, 'delete records in this table')
  if (viewerCheck) return viewerCheck

  const body = await c.req.json()
  if (body.ids && body.ids.length > 1000) {
    return c.json(
      {
        success: false,
        message: 'Batch size exceeds maximum of 1000 records',
        code: 'PAYLOAD_TOO_LARGE',
      },
      413
    )
  }

  const result = await validateRequest(c, batchDeleteRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  const authError = await resolveBatchMutationAuth({
    c,
    app,
    tableName,
    userRole,
    session,
    table,
    ids: result.data.ids,
    op: 'delete',
    canonicalCheck: () => hasDeletePermission(table, userRole, app.tables),
    forbiddenAction: 'delete',
  })
  if (authError) return authError

  const permanent = result.data.permanent === true || c.req.query('permanent') === 'true'

  const tappedProgram = batchDeleteProgram(session, tableName, result.data.ids, permanent).pipe(
    Effect.tapError((error) =>
      Effect.sync(() => {
        console.error(`[tables] batch ${permanent ? 'hard-' : 'soft-'}delete failed`, error)
      })
    )
  )

  return runEffect(c, provideTableLive(tappedProgram), batchDeleteRecordsResponseSchema)
}

async function handleUpsert(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const viewerCheck = checkViewerPermission(userRole, c)
  if (viewerCheck) return viewerCheck

  const result = await validateRequest(c, upsertRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  const hasIdField = result.data.records.some((record) => 'id' in record.fields)
  if (hasIdField) {
    return c.json(
      {
        success: false,
        message: 'Cannot set readonly field: id',
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  const validation = await validateUpsertRequest({
    c,
    app,
    tableName,
    userRole,
    records: result.data.records,
    fieldsToMergeOn: result.data.fieldsToMergeOn,
  })
  if (!validation.success) return validation.response

  const flatRecordsData = validation.strippedRecords.map((record) => record.fields)

  const program = upsertProgram(session, tableName, {
    recordsData: flatRecordsData,
    fieldsToMergeOn: result.data.fieldsToMergeOn,
    returnRecords: result.data.returnRecords,
    app,
  })

  const filteredProgram = applyReadFiltering({
    program,
    app,
    tableName,
    userRole,
  })

  return runEffect(c, provideTableLive(filteredProgram), upsertRecordsResponseSchema)
}

export function chainBatchRoutesMethods<T extends Hono>(honoApp: T, resolveApp: () => App) {
  return (
    honoApp
      .post('/api/tables/:tableId/records/batch/restore', (c) =>
        handleBatchRestore(c, resolveApp())
      )
      .post('/api/tables/:tableId/records/batch/delete', (c) => handleBatchDelete(c, resolveApp()))
      .post('/api/tables/:tableId/records/batch-delete', (c) => handleBatchDelete(c, resolveApp()))
      .post('/api/tables/:tableId/records/batch', (c) => handleBatchCreate(c, resolveApp()))
      .patch('/api/tables/:tableId/records/batch', (c) => handleBatchUpdate(c, resolveApp()))
      .delete('/api/tables/:tableId/records/batch', (c) => handleBatchDelete(c, resolveApp()))
      .post('/api/tables/:tableId/records/upsert', (c) => handleUpsert(c, resolveApp()))
  )
}

