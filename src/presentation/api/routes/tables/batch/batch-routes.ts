/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  markUserAuthoredAiFieldsForRecords,
  type AiComputeBatchWrite,
} from '@/application/use-cases/ai-compute/enqueue-refinement'
import {
  batchCreateProgram,
  batchUpdateProgram,
  batchDeleteProgram,
  batchRestoreProgram,
  upsertProgram,
} from '@/application/use-cases/tables/programs'
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
import { applyAiComputeBaseline } from '@/domain/services/ai-compute/apply-baseline'
import {
  hasCreatePermissionForRoles,
  hasReadPermissionForRoles,
  hasUpdatePermissionForRoles,
  hasDeletePermission,
  hasDeletePermissionForRoles,
} from '@/domain/validators/permission-evaluators'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { runTableProgram, provideTableLive } from '@/infrastructure/layers/table-layer'
import { logError } from '@/infrastructure/logging/logger'
import { runEffect } from '@/presentation/api/utils'
import { payloadTooLarge } from '@/presentation/api/utils/auth-helpers'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { validateRequest } from '@/presentation/api/utils/validate-request'
import {
  enforceBulkCreateGate,
  enforceBulkMutationGate,
  resolveGuardForTable,
} from '../record/row-level-guard'
import {
  validateReadonlyFields,
  validateUpsertRequest,
  applyReadFiltering,
  stripUnwritableFields,
} from '../record/upsert-helpers'
import { forbiddenCreateResponse } from '../response-helpers'
import { handleBatchRestoreError } from '../utils'
import {
  checkViewerPermission,
  checkRecordLimitExceeded,
  applyBatchReadFiltering,
  checkBatchFieldPermissions,
  validateBulkMultiSelectOptions,
  validateStrippedRecordsNotEmpty,
} from './batch-permission-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/* eslint-disable drizzle/enforce-delete-with-where -- These are Hono route methods, not Drizzle queries */

/**
 * Handle batch restore endpoint
 */
async function handleBatchRestore(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)

  // Authorization check BEFORE validation. Restore reuses the canonical DELETE
  // role gate, exactly as the single-record path does (`handleRestoreRecord`):
  // restore is the inverse of soft-delete, so one endpoint must not be a weaker
  // door onto the operation than the other. A hardcoded `userRole === 'viewer'`
  // test here ignored `permissions.delete` entirely and let any non-viewer role
  // restore rows on a table that grants delete to admins only.
  //
  // NOTE: deliberately NOT routed through `enforceBulkMutationGate`. That helper
  // resolves rows via the list program, which excludes soft-deleted rows — and a
  // restore target is by definition soft-deleted, so every row-level-scoped
  // batch restore would 404. Row-level scoping of batch restore is out of scope.
  //
  // S1 anti-enumeration: authz denial returns 404.
  if (!hasDeletePermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  // Check payload size before validation (mirrors batch-delete 1000-record guard)
  const body = await c.req.json()
  if (body.ids && body.ids.length > 1000) {
    return payloadTooLarge(c, 'Batch size exceeds maximum of 1000 records')
  }

  const result = await validateRequest(c, batchRestoreRecordsRequestSchema)
  if (!result.success) return result.response

  const programResult = await runTableProgram(
    batchRestoreProgram(session, tableName, result.data.ids)
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
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly table: ReturnType<NonNullable<App['tables']>['find']>
  readonly ids: readonly string[]
  readonly op: 'write' | 'delete'
  readonly canonicalCheck: () => boolean
  readonly forbiddenAction: 'update' | 'delete'
}): Promise<Response | undefined> {
  // `forbiddenAction` is kept on the input type for call-site readability
  // (and historical API stability) but is no longer surfaced in the response
  // envelope per S1 anti-enumeration.
  const { c, app, tableName, userRole, session, table, ids, op, canonicalCheck } = input
  const guard = await resolveGuardForTable(session, userRole, table, app)

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
  // S1 anti-enumeration: authz denial returns 404 so the permission
  // boundary for {update,delete} is not discoverable.
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

/**
 * Resolve the create-authorisation gate for batch create. Returns the
 * guard context (when the table is row-level scoped) so callers can chain
 * the per-row predicate check, or `undefined` for non-row-level tables.
 *
 * PARITY WITH THE SINGLE-RECORD PATH IS THE CONTRACT, and it is a three-part
 * contract — this gate used to satisfy none of it, and each omission is its own
 * defect. `checkCreateGate` (`../record/record-write-handlers.ts`) is the
 * reference implementation:
 *
 *  1. INHERITANCE. `app.tables` is the resolution set. Without it a table
 *     declaring `permissions: { inherit: '<parent>' }` resolves as if it had no
 *     create rule at all, so an inherited admin-only grant read as UNRESTRICTED
 *     on the batch path while the single-record path refused — the same request,
 *     two verdicts.
 *  2. GROUP GRANTS. A bare `userRole` can never match a `group:<name>` entry,
 *     because the group overlay exists only in the effective-role set built by
 *     `buildEffectiveRoles`. Passing the raw role leaves every group grant
 *     silently inert here while it works on the single-record route.
 *  3. S1 ANTI-ENUMERATION. A caller who also lacks READ access gets 404, not
 *     403 — a 403 confirms the table exists to someone with no business knowing
 *     it does.
 *
 * Fixing (1) alone is the trap: it closes the inheritance hole and leaves the
 * group hole open, while looking like the finding is closed.
 */
async function resolveBatchCreateAuth(input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  /** Group names the user belongs to (un-prefixed) — group-aware RBAC. */
  readonly userGroups: readonly string[]
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly records: readonly { readonly fields: Record<string, unknown> }[]
}): Promise<Response | undefined> {
  const { c, app, tableName, userRole, userGroups, session, records } = input
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table, app)

  if (guard) {
    return enforceBulkCreateGate({
      c,
      table,
      guard,
      records: records.map((r) => r.fields),
    })
  }
  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
  if (!hasCreatePermissionForRoles(table, effectiveRoles, app.tables)) {
    // S1 anti-enumeration, mirroring the single-record path: no read access
    // collapses the denial to 404 so the table's existence is not disclosed.
    if (!hasReadPermissionForRoles(table, effectiveRoles, app.tables)) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }
    return forbiddenCreateResponse(c)
  }
  return undefined
}

/**
 * Merge the [internal ref] Phase 2 deterministic `ai-*` baseline into each row of a
 * batch create, mirroring the single-record path in
 * `../record/record-write-handlers.ts`.
 *
 * Postgres computes the baseline in a synchronous BEFORE trigger, so it lands
 * whichever route inserted the row. SQLite has no procedural language, so the
 * merge is an in-process CALL — and only the single-record handler made it,
 * leaving a batch-created row with every `ai-*` column NULL and nothing queued
 * to fill it later. No-op on Postgres, and on tables with no AI-compute fields.
 */
const withAiComputeBaseline = (
  table: ReturnType<NonNullable<App['tables']>['find']>,
  records: readonly { readonly fields: Record<string, unknown> }[]
): ReadonlyArray<Record<string, unknown>> =>
  records.map((record) =>
    table && isSqliteRuntime()
      ? {
          ...record.fields,
          ...applyAiComputeBaseline({ table, op: 'insert', incoming: record.fields }),
        }
      : record.fields
  )

/**
 * Handle batch create endpoint
 */
async function handleBatchCreate(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole, userGroups } = getTableContext(c)

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
  // back to the group-aware hasCreatePermissionForRoles for non-row-level tables.
  const authError = await resolveBatchCreateAuth({
    c,
    app,
    tableName,
    userRole,
    userGroups,
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

  // Readonly-field and multi-select declared-option enforcement. The
  // single-record route gets the latter from `validateRecordCreation`; a bulk
  // route has to ask for it, and until it did, an undeclared option reached the
  // database — where only Postgres had a CHECK to stop it.
  const fieldGuard =
    validateReadonlyFields(table, result.data.records, c) ??
    (await validateBulkMultiSelectOptions(c, app, result.data.records))
  if (fieldGuard) return fieldGuard

  const flatRecordsData = withAiComputeBaseline(table, result.data.records)

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
 * [internal ref] Phase 2: after a successful batch update, stop reporting any AI column
 * the user wrote by hand as a failed computed fallback.
 *
 * Signalled from the handler rather than from the shared program: `recordsData`
 * here already pairs each id with exactly what the user sent, while the batch
 * programs are also reached by callers that carry no user-supplied field map at
 * all. Written as a pipeable so the handler stays inside its line budget.
 */
const signalUserAuthoredAiFields =
  (app: App, tableName: string, records: readonly AiComputeBatchWrite[]) =>
  <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    program.pipe(
      Effect.tap(() =>
        Effect.sync(() => markUserAuthoredAiFieldsForRecords({ app, tableName, records }))
      )
    )

/**
 * Handle batch update endpoint
 */
async function handleBatchUpdate(c: Context, app: App) {
  // Session, tableName, userRole and userGroups are guaranteed by middleware chain
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)

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
    // Effective roles, not a bare role: a `group:<name>` permission entry lives
    // only in the resolved set `buildEffectiveRoles` produces, so a bare string
    // could never match one and every `group:` update grant was silently inert
    // on this path while the sibling create gate (`:225`) honoured it.
    canonicalCheck: () => hasUpdatePermissionForRoles(table, effectiveRoles, app.tables),
    forbiddenAction: 'update',
  })
  if (authError) return authError

  // Readonly-field and multi-select enforcement, BEFORE permission checks. An
  // update reaches the same column as a create and needs the same guard.
  const fieldGuard =
    validateReadonlyFields(table, result.data.records, c) ??
    (await validateBulkMultiSelectOptions(c, app, result.data.records))
  if (fieldGuard) return fieldGuard

  // Field-level write permissions: strip unwritable fields, then require that
  // at least one writable field survives.
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

  const recordsData = strippedRecords.map((record) => ({ id: record.id, fields: record.fields }))

  // Execute batch update with field-level read filtering on response
  const filteredProgram = batchUpdateProgram({
    session,
    tableName,
    recordsData,
    returnRecords: result.data.returnRecords,
    app,
  }).pipe(
    signalUserAuthoredAiFields(app, tableName, recordsData),
    Effect.map((response) =>
      applyBatchReadFiltering(response, { app, tableName, userRole }, 'updated')
    )
  )

  return runEffect(c, provideTableLive(filteredProgram), batchUpdateRecordsResponseSchema)
}

/**
 * Handle batch delete endpoint
 *
 * Shared handler for both batch-delete route variants. The `permanent` flag is
 * read from the request BODY, where the Zod request schema validates it. It was
 * also readable from a `?permanent=true` query string; that spelling is gone,
 * so a hard delete is now declared in exactly one place.
 */
async function handleBatchDelete(c: Context, app: App) {
  // Session, tableName, userRole and userGroups are guaranteed by middleware chain
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)

  // Authorization check BEFORE validation (viewer role cannot delete)
  const viewerCheck = checkViewerPermission(userRole, c, 'delete records in this table')
  if (viewerCheck) return viewerCheck

  // Check payload size before validation
  const body = await c.req.json()
  if (body.ids && body.ids.length > 1000) {
    return payloadTooLarge(c, 'Batch size exceeds maximum of 1000 records')
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
    // Effective roles, not a bare role — same contract as the update gate
    // above. Serves BOTH `DELETE /records/batch` and
    // `POST /records/batch/delete`, which share this handler.
    canonicalCheck: () => hasDeletePermissionForRoles(table, effectiveRoles, app.tables),
    forbiddenAction: 'delete',
  })
  if (authError) return authError

  // The validated body is the only source for the `permanent` flag.
  const permanent = result.data.permanent === true

  const tappedProgram = batchDeleteProgram(session, tableName, result.data.ids, permanent).pipe(
    Effect.tapError((error) =>
      Effect.sync(() => {
        logError(`[tables] batch ${permanent ? 'hard-' : 'soft-'}delete failed`, error)
      })
    )
  )

  return runEffect(c, provideTableLive(tappedProgram), batchDeleteRecordsResponseSchema)
}

/**
 * Handle upsert endpoint
 */
async function handleUpsert(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

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

  // Readonly-field and multi-select enforcement, BEFORE permission checks.
  // Upsert is the third route onto the same column.
  const fieldGuard =
    validateReadonlyFields(table, result.data.records, c) ??
    (await validateBulkMultiSelectOptions(c, app, result.data.records))
  if (fieldGuard) return fieldGuard

  // Validate permissions and required fields
  const validation = await validateUpsertRequest({
    c,
    app,
    tableName,
    userRole,
    userGroups,
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
  )
}

/* eslint-enable drizzle/enforce-delete-with-where */
