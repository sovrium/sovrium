/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  batchCreateWithSideEffects,
  batchDeleteWithSideEffects,
  batchRestoreWithSideEffects,
  batchUpdateWithSideEffects,
} from '@/application/use-cases/tables/record-batch-orchestration'
import { recordWriteRequester } from '@/application/use-cases/tables/record-create-orchestration'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  batchCreateRecordsRequestSchema,
  batchUpdateRecordsRequestSchema,
  batchDeleteRecordsRequestSchema,
  batchRestoreRecordsRequestSchema,
} from '@/domain/models/api/tables/records'
import {
  batchCreateRecordsResponseSchema,
  batchUpdateRecordsResponseSchema,
  batchDeleteRecordsResponseSchema,
  batchRestoreRecordsResponseSchema,
} from '@/domain/models/api/tables/tables'
import {
  hasUpdatePermissionForRoles,
  hasDeletePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { notFound, payloadTooLarge } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import { validatedBody } from '@/presentation/api/runtime/validate-request'
import {
  checkViewerPermission,
  checkRecordLimitExceeded,
  applyBatchReadFiltering,
  batchCreateAnswer,
  validateStrippedRecordsNotEmpty,
} from './batch-permission-helpers'
import {
  addressableBatchItems,
  batchUpdateTargets,
  refuseNonKeyBatchDelete,
  refuseBatchDeleteTargets,
  refuseBatchRestoreIds,
} from './batch-record-ids'
import { guardBatchCreate, guardBatchUpdateValues, readPreGuardBody } from './batch-write-guards'
import { handleBatchRestoreError } from './error-helpers'
import { importRecordsRoute } from './record-import-handlers'
import { getLinkReader } from './relationship-rules'
import {
  enforceBulkMutationGate,
  enforceRestoreGate,
  guardForTable,
  passesUnguardedTableGate,
  restoreRoleGateAdmits,
} from './row-level-guard'
import { answerDeleteProgram } from './still-linked-conflict'
import { callerReadsTable } from './table-read-gate'
import { maskUnreadableUniqueConflict, restoredWrite, updatedWrite } from './unique-conflict-mask'
import { stripUnwritableFields } from './upsert-helpers'
import { handleUpsert } from './upsert-route'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Handle batch restore endpoint
 */
function handleBatchRestore(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, batchRestoreResponse(c, app)))
}

/** Gate, restore and answer a batch restore, as one program. */
const batchRestoreResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    // Session, tableName, userRole and userGroups are guaranteed by middleware chain
    const { session, tableName, userRole, userGroups } = getTableContext(c)

    const table = app.tables?.find((t) => t.name === tableName)
    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)

    // Authorization check BEFORE validation. Restore reuses the canonical DELETE
    // role gate, exactly as the single-record path does (`handleRestoreRecord`):
    // restore is the inverse of soft-delete, so one endpoint must not be a weaker
    // door onto the operation than the other. Under row-level rules the gate is
    // the guard's, over the caller's effective roles (assignment roles included),
    // and the rules themselves are checked on the trashed rows once the ids are
    // known (below).
    //
    // S1 anti-enumeration: authz denial returns 404.
    const permitted = guard
      ? restoreRoleGateAdmits(table, guard)
      : passesUnguardedTableGate(app, table, { userRole, userGroups }, 'delete')
    if (!permitted) return notFound(c)

    // Check payload size before validation (mirrors batch-delete 1000-record guard)
    const body = yield* readPreGuardBody(c)
    if (body.ids && body.ids.length > 1000) {
      return payloadTooLarge(c, 'Batch size exceeds maximum of 1000 records')
    }

    const result = yield* validatedBody(c, batchRestoreRecordsRequestSchema)
    if (!result.success) return result.response
    // An id no key could hold, or that her list of the table does not admit, is
    // refused as a missing id is — before the row-level gate, which would answer
    // a missing id on its own.
    const idRefusal = yield* refuseBatchRestoreIds(c, app, table, result.data.ids)
    if (idRefusal !== undefined) return idRefusal

    // A batch naming one row the caller's rules exclude is refused whole, as a
    // missing row is, and restores nothing.
    const ids = result.data.ids.map(String)
    const rowGateError = yield* enforceRestoreGate({ c, table, session, tableName, ids, guard })
    if (rowGateError) return rowGateError

    const programResult = yield* Effect.result(
      batchRestoreWithSideEffects({
        ...{ session, tableName, app, ids },
        ...{ requester: recordWriteRequester(session.userId, userRole), userGroups },
      })
    )

    if (programResult._tag === 'Failure') {
      const refusal = handleBatchRestoreError(c, programResult.failure)
      return yield* maskUnreadableUniqueConflict(c, app, restoredWrite(c, ids), refusal)
    }

    return yield* respondWith(
      c,
      Effect.succeed(programResult.success),
      batchRestoreRecordsResponseSchema
    )
  })

/**
 * Resolve the mutation-authorisation gate for batch update / delete.
 * Returns the first error response, or `undefined` on pass.
 */
const resolveBatchMutationAuth = (input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly table: ReturnType<NonNullable<App['tables']>['find']>
  readonly ids: readonly string[]
  readonly op: 'write' | 'delete'
  readonly canonicalCheck: () => boolean
  readonly forbiddenAction: 'update' | 'delete'
  readonly changes?: ReadonlyMap<string, Readonly<Record<string, unknown>>>
}) =>
  Effect.gen(function* () {
    // `forbiddenAction` is kept on the input type for call-site readability
    // (and historical API stability) but is no longer surfaced in the response
    // envelope per S1 anti-enumeration.
    const { c, app, tableName, session, table, ids, op, canonicalCheck, changes } = input
    const { userRole, userGroups } = input
    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)

    if (guard) {
      return yield* enforceBulkMutationGate({
        c,
        table,
        session,
        tableName,
        ids,
        guard,
        op,
        changes,
      })
    }
    // S1 anti-enumeration: authz denial returns 404 so the permission
    // boundary for {update,delete} is not discoverable.
    if (!canonicalCheck()) {
      return c.json(
        {
          success: false,
          error: 'Not Found',
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
        404
      )
    }
    return undefined
  })

/**
 * Handle batch create endpoint
 */
function handleBatchCreate(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, batchCreateResponse(c, app)))
}

/** Gate, create and answer a batch create, as one program. */
const batchCreateResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    // Session, tableName, and userRole are guaranteed by middleware chain
    const { session, tableName, userRole, userGroups } = getTableContext(c)

    // A viewer the table does not name in its create grant is refused BEFORE validation.
    const viewerCheck = checkViewerPermission(c, app, ['create'])
    if (viewerCheck) return viewerCheck

    // Check record count before validation to return 413 for payload too large
    const body = yield* readPreGuardBody(c)
    const recordLimitCheck = checkRecordLimitExceeded(body.records || [], c)
    if (recordLimitCheck) return recordLimitCheck

    const result = yield* validatedBody(c, batchCreateRecordsRequestSchema)
    if (!result.success) return result.response

    const table = app.tables?.find((t) => t.name === tableName)
    const refusal = yield* guardBatchCreate(c, app, result.data.records)
    if (refusal) return refusal

    // The batch create and its side effects (`record-batch-orchestration.ts`).
    const program = batchCreateWithSideEffects({
      ...{ session, tableName, app, linkReader: getLinkReader(c) },
      ...{ requester: recordWriteRequester(session.userId, userRole), userGroups },
      rows: result.data.records.map((record) => record.fields),
      returnRecords: result.data.returnRecords,
    })

    // Field-level read filtering on the records returned; a caller who may not
    // read the table is handed back the count alone — no value, no id.
    const readsTable = yield* callerReadsTable(c, app, table)
    const filteredProgram = program.pipe(
      Effect.map(batchCreateAnswer(readsTable, { app, tableName, userRole, userGroups }))
    )

    const response = yield* respondWith(c, filteredProgram, batchCreateRecordsResponseSchema, 201)
    const written = result.data.records.map((record) => record.fields)
    return yield* maskUnreadableUniqueConflict(c, app, { written }, response)
  })

/**
 * Handle batch update endpoint. Authorization is row-level scoping when the
 * table declares it — each row checked as it stands and as it would be
 * written — and the canonical role check otherwise.
 */
function handleBatchUpdate(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, batchUpdateResponse(c, app)))
}

/** Gate, update and answer a batch update, as one program. */
const batchUpdateResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    // Session, tableName, userRole and userGroups are guaranteed by middleware chain
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const writer = { role: userRole, groups: userGroups }
    // A viewer the table does not name in its update grant is refused BEFORE validation.
    const viewerCheck = checkViewerPermission(c, app, ['update'])
    if (viewerCheck) return viewerCheck

    const result = yield* validatedBody(c, batchUpdateRecordsRequestSchema)
    if (!result.success) return result.response

    const table = app.tables?.find((t) => t.name === tableName)
    const { records } = result.data
    const addressable = yield* addressableBatchItems(c, app, table, records)
    const authError = yield* resolveBatchMutationAuth({
      ...{ c, app, tableName, userRole, userGroups, session, table },
      ...batchUpdateTargets(app, tableName, writer, addressable(records)),
      op: 'write',
      // Effective roles, not a bare role: a `group:<name>` permission entry lives
      // only in the resolved set `buildEffectiveRoles` produces, so a bare string
      // could never match one and every `group:` update grant was silently inert
      // on this path while the sibling create gate (`:225`) honoured it.
      canonicalCheck: () =>
        hasUpdatePermissionForRoles(table, buildEffectiveRoles(userRole, userGroups), app),
      forbiddenAction: 'update',
    })
    if (authError) return authError

    // The readonly, computed and per-value rules, before the field write strip.
    const fieldGuard = yield* guardBatchUpdateValues(c, app, records)
    if (fieldGuard) return fieldGuard

    // Field-level write permissions: strip unwritable fields, then require that
    // at least one writable field survives.
    const strippedRecords = stripUnwritableFields(app, tableName, writer, records)
    const strippedValidation = validateStrippedRecordsNotEmpty({
      ...{ strippedRecords, originalRecords: records, app, tableName, userRole, c },
    })
    if (strippedValidation) return strippedValidation

    const recordsData = addressable(strippedRecords).map((record) => ({
      id: record.id,
      fields: record.fields,
    }))
    // The batch update and its side effects, with field-level read filtering on the response
    const filteredProgram = batchUpdateWithSideEffects({
      ...{ session, tableName, app, linkReader: getLinkReader(c) },
      ...{ requester: recordWriteRequester(session.userId, userRole), userGroups },
      records: recordsData,
      returnRecords: result.data.returnRecords,
    }).pipe(
      Effect.map((response) =>
        applyBatchReadFiltering(response, { app, tableName, userRole, userGroups }, 'updated')
      )
    )

    const response = yield* respondWith(c, filteredProgram, batchUpdateRecordsResponseSchema)
    return yield* maskUnreadableUniqueConflict(c, app, updatedWrite(recordsData), response)
  })

/**
 * Handle batch delete endpoint
 *
 * Shared handler for both batch-delete route variants. The `permanent` flag is
 * read from the request BODY, where the request schema validates it (the old
 * `?permanent=true` query is gone), so a hard delete is declared in one place.
 */
function handleBatchDelete(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, batchDeleteResponse(c, app)))
}

/** Gate, delete and answer a batch delete, as one program. */
const batchDeleteResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    // Session, tableName, userRole and userGroups are guaranteed by middleware chain
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const effectiveRoles = buildEffectiveRoles(userRole, userGroups)

    // A viewer the table does not name in its delete grant is refused BEFORE validation.
    const viewerCheck = checkViewerPermission(c, app, ['delete'])
    if (viewerCheck) return viewerCheck

    // Check payload size before validation
    const body = yield* readPreGuardBody(c)
    if (body.ids && body.ids.length > 1000) {
      return payloadTooLarge(c, 'Batch size exceeds maximum of 1000 records')
    }

    const result = yield* validatedBody(c, batchDeleteRecordsRequestSchema)
    if (!result.success) return result.response

    const table = app.tables?.find((t) => t.name === tableName)

    // Authorization: row-level scoping when declared, canonical role check otherwise.
    const nonKeyRefusal = refuseNonKeyBatchDelete(c, app, table, result.data.ids)
    if (nonKeyRefusal !== undefined) return nonKeyRefusal
    const authError = yield* resolveBatchMutationAuth({
      c,
      app,
      tableName,
      userRole,
      userGroups,
      session,
      table,
      ids: result.data.ids,
      op: 'delete',
      // Effective roles, not a bare role — same contract as the update gate
      // above. Serves BOTH `DELETE /records/batch` and
      // `POST /records/batch/delete`, which share this handler.
      canonicalCheck: () => hasDeletePermissionForRoles(table, effectiveRoles, app),
      forbiddenAction: 'delete',
    })
    if (authError) return authError

    // The validated body is the only source for the `permanent` flag. A
    // permanent delete is an admin-equivalent role's, exactly as the
    // single-record `?permanent=true` is; anyone else gets its 404 and nothing
    // is destroyed. An id her list of the table does not admit is refused as a
    // missing id is.
    const permanent = result.data.permanent === true
    const idRefusal = yield* refuseBatchDeleteTargets(c, app, {
      ...{ ids: result.data.ids, permanent, role: userRole },
    })
    if (idRefusal) return idRefusal
    const program = batchDeleteWithSideEffects({
      ...{ session, tableName, app, permanent },
      ...{ requester: recordWriteRequester(session.userId, userRole), userGroups },
      ids: result.data.ids,
    })
    return yield* answerDeleteProgram(c, app, program, batchDeleteRecordsResponseSchema)
  })

export function chainBatchRoutesMethods(honoApp: Hono, app: App): void {
  honoApp
    // IMPORTANT: More specific routes (batch/restore, batch/delete) must come BEFORE generic batch routes
    .post('/api/tables/:tableId/records/batch/restore', (c) => handleBatchRestore(c, app))
    .post('/api/tables/:tableId/records/batch/delete', (c) => handleBatchDelete(c, app))
    // Generic batch routes AFTER more specific batch/restore and batch/delete routes
    .post('/api/tables/:tableId/records/batch', (c) => handleBatchCreate(c, app))
    .patch('/api/tables/:tableId/records/batch', (c) => handleBatchUpdate(c, app))
    .delete('/api/tables/:tableId/records/batch', (c) => handleBatchDelete(c, app))
    .post('/api/tables/:tableId/records/upsert', (c) => handleUpsert(c, app))
    .post('/api/tables/:tableId/records/import', importRecordsRoute(app))
}
