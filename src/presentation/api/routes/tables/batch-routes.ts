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

/* eslint-disable drizzle/enforce-delete-with-where -- These are Hono route methods, not Drizzle queries */

/**
 * Handle batch restore endpoint
 */
async function handleBatchRestore(c: Context, _app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot restore)
  if (userRole === 'viewer') {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to restore records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  // Check payload size before validation (mirrors batch-delete 1000-record guard)
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

/**
 * Resolve the mutation-authorisation gate for batch update / delete.
 * Returns the first error response, or `undefined` on pass.
 */
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
  const { c, tableName, userRole, session, table, ids, op, canonicalCheck, forbiddenAction } = input
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
        message: `You do not have permission to ${forbiddenAction} records in this table`,
        code: 'FORBIDDEN',
      },
      403
    )
  }
  return undefined
}

/**
 * Resolve the create-authorisation gate for batch create. Returns the
 * guard context (when the table is row-level scoped) so callers can chain
 * the per-row predicate check, or `undefined` for non-row-level tables.
 */
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

/**
 * Handle batch create endpoint
 */
async function handleBatchCreate(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot create)
  const viewerCheck = checkViewerPermission(userRole, c)
  if (viewerCheck) return viewerCheck

  // Check record count before validation to return 413 for payload too large
  const body = await c.req.json()
  const recordLimitCheck = checkRecordLimitExceeded(body.records || [], c)
  if (recordLimitCheck) return recordLimitCheck

  const result = await validateRequest(c, batchCreateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Z-3: row-level role+predicate gate when the table declares it. Falls
  // back to canonical hasCreatePermission for non-row-level-enforced tables.
  const authError = await resolveBatchCreateAuth({
    c,
    app,
    tableName,
    userRole,
    session,
    records: result.data.records,
  })
  if (authError) return authError

  // Check field-level permissions
  const fieldPermCheck = checkBatchFieldPermissions({
    records: result.data.records,
    app,
    tableName,
    userRole,
    c,
  })
  if (fieldPermCheck) return fieldPermCheck

  // Validate readonly fields
  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  // Extract flat field objects from records for database layer
  const flatRecordsData = result.data.records.map((record) => record.fields)

  // Execute batch create with returnRecords parameter and app for numeric coercion
  const program = batchCreateProgram({
    session,
    tableName,
    recordsData: flatRecordsData,
    returnRecords: result.data.returnRecords,
    app,
  })

  // Apply field-level read filtering to response (if records returned)
  const filteredProgram = program.pipe(
    Effect.map((response) =>
      applyBatchReadFiltering(response, { app, tableName, userRole }, 'created')
    )
  )

  return runEffect(c, provideTableLive(filteredProgram), batchCreateRecordsResponseSchema, 201)
}

/**
 * Handle batch update endpoint
 */
async function handleBatchUpdate(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot update)
  const viewerCheck = checkViewerPermission(userRole, c)
  if (viewerCheck) return viewerCheck

  const result = await validateRequest(c, batchUpdateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Authorization: row-level scoping when declared, canonical role check otherwise.
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

  // Validate readonly fields BEFORE permission checks
  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  // Authorization: Check field-level write permissions and strip unwritable fields
  const strippedRecords = stripUnwritableFields(app, tableName, userRole, result.data.records)

  // Validate at least some writable fields remain after stripping
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

  // Execute batch update with field-level read filtering on response
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

/**
 * Handle batch delete endpoint
 *
 * Shared handler for all batch-delete route variants. The `permanent` flag is
 * resolved from the body when present (Zod-validated via the request schema) and
 * falls back to the `?permanent=true` query string for routes that keep the
 * legacy query-parameter contract.
 */
async function handleBatchDelete(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot delete)
  const viewerCheck = checkViewerPermission(userRole, c, 'delete records in this table')
  if (viewerCheck) return viewerCheck

  // Check payload size before validation
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

  // Authorization: row-level scoping when declared, canonical role check otherwise.
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

  // Resolve the `permanent` flag from the validated body first, then fall back
  // to the legacy `?permanent=true` query parameter.
  const permanent = result.data.permanent === true || c.req.query('permanent') === 'true'

  return runEffect(
    c,
    provideTableLive(batchDeleteProgram(session, tableName, result.data.ids, permanent)),
    batchDeleteRecordsResponseSchema
  )
}

/**
 * Handle upsert endpoint
 */
async function handleUpsert(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot upsert)
  const viewerCheck = checkViewerPermission(userRole, c)
  if (viewerCheck) return viewerCheck

  const result = await validateRequest(c, upsertRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Check for 'id' field (always readonly) with upsert-specific message
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

  // Validate readonly fields BEFORE permission checks
  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  // Validate permissions and required fields
  const validation = await validateUpsertRequest({
    c,
    app,
    tableName,
    userRole,
    records: result.data.records,
    fieldsToMergeOn: result.data.fieldsToMergeOn,
  })
  if (!validation.success) return validation.response

  // Extract flat field objects for database layer
  const flatRecordsData = validation.strippedRecords.map((record) => record.fields)

  // Execute upsert
  const program = upsertProgram(session, tableName, {
    recordsData: flatRecordsData,
    fieldsToMergeOn: result.data.fieldsToMergeOn,
    returnRecords: result.data.returnRecords,
    app,
  })

  // Apply field-level read filtering to response
  const filteredProgram = applyReadFiltering({
    program,
    app,
    tableName,
    userRole,
  })

  return runEffect(c, provideTableLive(filteredProgram), upsertRecordsResponseSchema)
}

export function chainBatchRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return (
    honoApp
      // IMPORTANT: More specific routes (batch/restore, batch/delete) must come BEFORE generic batch routes
      .post('/api/tables/:tableId/records/batch/restore', (c) => handleBatchRestore(c, app))
      .post('/api/tables/:tableId/records/batch/delete', (c) => handleBatchDelete(c, app))
      .post('/api/tables/:tableId/records/batch-delete', (c) => handleBatchDelete(c, app))
      // Generic batch routes AFTER more specific batch/restore and batch/delete routes
      .post('/api/tables/:tableId/records/batch', (c) => handleBatchCreate(c, app))
      .patch('/api/tables/:tableId/records/batch', (c) => handleBatchUpdate(c, app))
      .delete('/api/tables/:tableId/records/batch', (c) => handleBatchDelete(c, app))
      .post('/api/tables/:tableId/records/upsert', (c) => handleUpsert(c, app))
  )
}

/* eslint-enable drizzle/enforce-delete-with-where */
