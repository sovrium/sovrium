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
  upsertWithSideEffects,
} from '@/application/use-cases/tables/record-batch-orchestration'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
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
import {
  hasUpdatePermissionForRoles,
  hasDeletePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { notFound, payloadTooLarge } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runEffect, runOnRequest } from '@/presentation/api/runtime/run-effect'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import {
  checkViewerPermission,
  checkRecordLimitExceeded,
  applyBatchReadFiltering,
  batchCreateAnswer,
  validateBulkFieldValues,
  validateStrippedRecordsNotEmpty,
} from './batch-permission-helpers'
import {
  batchUpdateTargets,
  keyShapedBatchItems,
  refuseNonKeyBatchDelete,
  refuseNonKeyBatchRestore,
} from './batch-record-ids'
import { guardBatchCreate, guardUpsert } from './batch-write-guards'
import { handleBatchRestoreError } from './error-helpers'
import { handleImportRecords } from './record-import-handlers'
import { getLinkReader } from './relationship-rules'
import {
  enforceBulkMutationGate,
  enforceRestoreGate,
  passesUnguardedTableGate,
  resolveGuardForTable,
  restoreRoleGateAdmits,
} from './row-level-guard'
import { callerReadsTable } from './table-read-gate'
import { validateReadonlyFields, applyReadFiltering, stripUnwritableFields } from './upsert-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Read the request body for a SIZE PRE-GUARD, without throwing on a body that
 * is not JSON.
 *
 * The three batch handlers below each read the body twice: once here, to decide
 * whether the payload exceeds the 1000-entry cap, and once inside
 * `validateRequest` for the real decode. Only the second read is protected. A
 * bare `await c.req.json()` therefore turns a malformed body into a
 * `SyntaxError` that escapes the handler, reaches `createHonoApp`'s `.onError`,
 * and comes back 500 `INTERNAL_ERROR` with a `reportException` alongside it —
 * a caller's typo paging the operator for a fault that is not the server's.
 *
 * Degrading to `{}` lets the pre-guard decline (it sees no oversized array) and
 * hands the same input to `validateRequest`, which already owns the correct
 * answer for it: 400 `{ code: 'VALIDATION_ERROR', message: 'Invalid JSON body' }`.
 * The repair belongs here and not in `.onError`, which must keep reporting
 * genuine server faults as 500s.
 *
 * The parse is repeated rather than shared because Hono caches the request TEXT
 * and re-runs `JSON.parse` per call, so the second read throws independently of
 * this one — which is exactly what makes the fall-through safe.
 */
const readPreGuardBody = async (
  c: Context
): Promise<{ readonly ids?: readonly unknown[]; readonly records?: readonly unknown[] }> =>
  c.req.json().catch(() => ({}))

/**
 * Handle batch restore endpoint
 */
async function handleBatchRestore(c: Context, app: App) {
  // Session, tableName, userRole and userGroups are guaranteed by middleware chain
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })

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
  const body = await readPreGuardBody(c)
  if (body.ids && body.ids.length > 1000) {
    return payloadTooLarge(c, 'Batch size exceeds maximum of 1000 records')
  }

  const result = await validateRequest(c, batchRestoreRecordsRequestSchema)
  if (!result.success) return result.response
  const nonKeyRefusal = refuseNonKeyBatchRestore(c, table, result.data.ids)
  if (nonKeyRefusal !== undefined) return nonKeyRefusal

  // A batch naming one row the caller's rules exclude is refused whole, as a
  // missing row is, and restores nothing.
  const ids = result.data.ids.map(String)
  const rowGateError = await enforceRestoreGate({ c, table, session, tableName, ids, guard })
  if (rowGateError) return rowGateError

  const programResult = await runOnRequest(
    c,
    batchRestoreWithSideEffects({ session, tableName, app, ids, processEnv: process.env })
  )

  if (programResult._tag === 'Failure') {
    return handleBatchRestoreError(c, programResult.failure)
  }

  return c.json(programResult.success, 200)
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
  readonly userGroups: readonly string[]
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly table: ReturnType<NonNullable<App['tables']>['find']>
  readonly ids: readonly string[]
  readonly op: 'write' | 'delete'
  readonly canonicalCheck: () => boolean
  readonly forbiddenAction: 'update' | 'delete'
  readonly changes?: ReadonlyMap<string, Readonly<Record<string, unknown>>>
}): Promise<Response | undefined> {
  // `forbiddenAction` is kept on the input type for call-site readability
  // (and historical API stability) but is no longer surfaced in the response
  // envelope per S1 anti-enumeration.
  const { c, app, tableName, session, table, ids, op, canonicalCheck, changes } = input
  const { userRole, userGroups } = input
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })

  if (guard) {
    return enforceBulkMutationGate({
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
}

/**
 * Handle batch create endpoint
 */
async function handleBatchCreate(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  // A viewer the table does not name in its create grant is refused BEFORE validation.
  const viewerCheck = checkViewerPermission(c, app, ['create'])
  if (viewerCheck) return viewerCheck

  // Check record count before validation to return 413 for payload too large
  const body = await readPreGuardBody(c)
  const recordLimitCheck = checkRecordLimitExceeded(body.records || [], c)
  if (recordLimitCheck) return recordLimitCheck

  const result = await validateRequest(c, batchCreateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)
  const refusal = await guardBatchCreate(c, app, result.data.records)
  if (refusal) return refusal

  // The batch create and its side effects (`record-batch-orchestration.ts`).
  const program = batchCreateWithSideEffects({
    ...{ session, tableName, app, linkReader: getLinkReader(c), processEnv: process.env },
    rows: result.data.records.map((record) => record.fields),
    returnRecords: result.data.returnRecords,
    isSqlite: isSqliteRuntime(),
  })

  // Field-level read filtering on the records returned; a caller who may not
  // read the table is handed back the count alone — no value, no id.
  const readsTable = await callerReadsTable(c, app, table)
  const filteredProgram = program.pipe(
    Effect.map(batchCreateAnswer(readsTable, { app, tableName, userRole, userGroups }))
  )

  return runEffect(c, provideDomain(c, filteredProgram), batchCreateRecordsResponseSchema, 201)
}

/**
 * Handle batch update endpoint. Authorization is row-level scoping when the
 * table declares it — each row checked as it stands and as it would be
 * written — and the canonical role check otherwise.
 */
async function handleBatchUpdate(c: Context, app: App) {
  // Session, tableName, userRole and userGroups are guaranteed by middleware chain
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
  const writer = { role: userRole, groups: userGroups }
  // A viewer the table does not name in its update grant is refused BEFORE validation.
  const viewerCheck = checkViewerPermission(c, app, ['update'])
  if (viewerCheck) return viewerCheck

  const result = await validateRequest(c, batchUpdateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)
  const { records } = result.data
  const authError = await resolveBatchMutationAuth({
    ...{ c, app, tableName, userRole, userGroups, session, table },
    // An item whose id no key could hold is skipped, as a missing id is.
    ...batchUpdateTargets(app, tableName, writer, keyShapedBatchItems(table, records)),
    op: 'write',
    // Effective roles, not a bare role: a `group:<name>` permission entry lives
    // only in the resolved set `buildEffectiveRoles` produces, so a bare string
    // could never match one and every `group:` update grant was silently inert
    // on this path while the sibling create gate (`:225`) honoured it.
    canonicalCheck: () => hasUpdatePermissionForRoles(table, effectiveRoles, app),
    forbiddenAction: 'update',
  })
  if (authError) return authError

  // Readonly-field and per-value enforcement, BEFORE permission checks. An
  // update reaches the same column as a create and needs the same guard.
  const fieldGuard =
    validateReadonlyFields(table, records, c) ?? (await validateBulkFieldValues(c, app, records))
  if (fieldGuard) return fieldGuard

  // Field-level write permissions: strip unwritable fields, then require that
  // at least one writable field survives.
  const strippedRecords = stripUnwritableFields(app, tableName, writer, records)
  const strippedValidation = validateStrippedRecordsNotEmpty({
    strippedRecords,
    originalRecords: records,
    app,
    tableName,
    userRole,
    c,
  })
  if (strippedValidation) return strippedValidation

  const recordsData = keyShapedBatchItems(table, strippedRecords).map((record) => ({
    id: record.id,
    fields: record.fields,
  }))
  // The batch update and its side effects, with field-level read filtering on the response
  const filteredProgram = batchUpdateWithSideEffects({
    ...{ session, tableName, app, linkReader: getLinkReader(c), processEnv: process.env },
    records: recordsData,
    returnRecords: result.data.returnRecords,
  }).pipe(
    Effect.map((response) =>
      applyBatchReadFiltering(response, { app, tableName, userRole, userGroups }, 'updated')
    )
  )

  return runEffect(c, provideDomain(c, filteredProgram), batchUpdateRecordsResponseSchema)
}

/**
 * Handle batch delete endpoint
 *
 * Shared handler for both batch-delete route variants. The `permanent` flag is
 * read from the request BODY, where the request schema schema validates it. It was
 * also readable from a `?permanent=true` query string; that spelling is gone,
 * so a hard delete is now declared in exactly one place.
 */
async function handleBatchDelete(c: Context, app: App) {
  // Session, tableName, userRole and userGroups are guaranteed by middleware chain
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)

  // A viewer the table does not name in its delete grant is refused BEFORE validation.
  const viewerCheck = checkViewerPermission(c, app, ['delete'])
  if (viewerCheck) return viewerCheck

  // Check payload size before validation
  const body = await readPreGuardBody(c)
  if (body.ids && body.ids.length > 1000) {
    return payloadTooLarge(c, 'Batch size exceeds maximum of 1000 records')
  }

  const result = await validateRequest(c, batchDeleteRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Authorization: row-level scoping when declared, canonical role check otherwise.
  const nonKeyRefusal = refuseNonKeyBatchDelete(c, table, result.data.ids)
  if (nonKeyRefusal !== undefined) return nonKeyRefusal
  const authError = await resolveBatchMutationAuth({
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
  // is destroyed.
  const permanent = result.data.permanent === true
  if (permanent && !isAdminEquivalent(userRole, app)) return notFound(c)
  const program = batchDeleteWithSideEffects({
    ...{ session, tableName, app, permanent, processEnv: process.env },
    ids: result.data.ids,
  })
  return runEffect(c, provideDomain(c, program), batchDeleteRecordsResponseSchema)
}

/**
 * Handle upsert endpoint
 */
async function handleUpsert(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  // A viewer the table names in neither its create nor its update grant is
  // refused BEFORE validation; `validateUpsertRequest` decides the rest.
  const viewerCheck = checkViewerPermission(c, app, ['create', 'update'])
  if (viewerCheck) return viewerCheck

  const result = await validateRequest(c, upsertRecordsRequestSchema)
  if (!result.success) return result.response

  const validation = await guardUpsert(c, app, result.data.records, result.data.fieldsToMergeOn)
  if (!validation.success) return validation.response

  // Extract flat field objects for database layer
  const flatRecordsData = validation.strippedRecords.map((record) => record.fields)

  // Execute upsert, with a record event per row inserted or matched
  const program = upsertWithSideEffects({
    ...{ session, tableName, processEnv: process.env },
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

  return runEffect(c, provideDomain(c, filteredProgram), upsertRecordsResponseSchema)
}

export function chainBatchRoutesMethods<T extends Hono>(honoApp: T, resolveApp: () => App) {
  return (
    honoApp
      // IMPORTANT: More specific routes (batch/restore, batch/delete) must come BEFORE generic batch routes
      .post('/api/tables/:tableId/records/batch/restore', (c) =>
        handleBatchRestore(c, resolveApp())
      )
      .post('/api/tables/:tableId/records/batch/delete', (c) => handleBatchDelete(c, resolveApp()))
      // Generic batch routes AFTER more specific batch/restore and batch/delete routes
      .post('/api/tables/:tableId/records/batch', (c) => handleBatchCreate(c, resolveApp()))
      .patch('/api/tables/:tableId/records/batch', (c) => handleBatchUpdate(c, resolveApp()))
      .delete('/api/tables/:tableId/records/batch', (c) => handleBatchDelete(c, resolveApp()))
      .post('/api/tables/:tableId/records/upsert', (c) => handleUpsert(c, resolveApp()))
      .post('/api/tables/:tableId/records/import', (c) => handleImportRecords(c, resolveApp()))
  )
}
