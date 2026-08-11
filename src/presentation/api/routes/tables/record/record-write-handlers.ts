/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- the record create-write orchestration surface
   (create gate/predicate → validation → SQLite AI-compute baseline merge →
   create program with realtime + automations + webhooks + [internal ref] AI-compute
   write-phase signalling taps, plus the form-update create variant). The taps
   share one create program; splitting would duplicate that composition. */

import { Effect } from 'effect'
import { signalAiComputeWritePhase } from '@/application/use-cases/ai-compute/enqueue-refinement'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import {
  createRecordProgram,
  rawGetRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/programs'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/domain/models/api/tables/records'
import { createRecordResponseSchema } from '@/domain/models/api/tables/tables'
import { applyAiComputeBaseline } from '@/domain/services/ai-compute/apply-baseline'
import {
  hasCreatePermissionForRoles,
  hasReadPermissionForRoles,
} from '@/domain/validators/permission-evaluators'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  provideTableWithAutomationsLive,
  runTableProgram,
} from '@/infrastructure/layers/table-layer'
import { publishRecordChange } from '@/infrastructure/realtime/record-change-publisher'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import {
  validateRecordCreation,
  createValidationLayer,
  formatValidationError,
} from '@/presentation/api/validation'
import { provideStorageLive } from '../../buckets/effect-runner'
import { handleRouteError } from '../error-handlers'
import { forbiddenCreateResponse, forbiddenCreateScopeResponse } from '../response-helpers'
import {
  checkFieldConditionReadOnly,
  sanitizeUpdateRichTextFields,
  validateUpdateFieldValues,
  validateUpdateForbiddenFields,
  validateUpdateReadonlyFields,
} from './record-update-guards'
import {
  checkTableUpdatePermissionWithRole,
  filterAllowedFieldsWithRole,
  handleNoAllowedFields,
  executeUpdate,
} from './record-update-handler'
import {
  enforceFormMutationGate,
  passesTableRoleGate,
  recordPassesPredicate,
  resolveGuardForTable,
  type RowLevelGuardContext,
} from './row-level-guard'
import type { App, Table } from '@/domain/models/app'
import type {
  hasCreatePermission,
  hasReadPermission,
} from '@/domain/validators/permission-evaluators'
import type { Context } from 'hono'

/**
 * Check create permission for table and user role
 * Returns error response if permission denied, undefined otherwise
 */
function checkCreatePermission(
  table: Parameters<typeof hasCreatePermission>[0],
  effectiveRoles: readonly string[],
  c: Context,
  allTables?: App['tables']
) {
  if (hasCreatePermissionForRoles(table, effectiveRoles, allTables)) return undefined
  // Enumeration protection: users without read access get 404 (prevents resource discovery)
  const readTable = table as Parameters<typeof hasReadPermission>[0]
  if (!hasReadPermissionForRoles(readTable, effectiveRoles, allTables)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return forbiddenCreateResponse(c)
}

interface CreateGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly userRole: string
  /** Group names the user belongs to (un-prefixed) — group-aware RBAC. */
  readonly userGroups: readonly string[]
  readonly guard: RowLevelGuardContext | undefined
}

/**
 * Z-3 create role gate. Returns 404/403/undefined depending on permissions.
 */
function checkCreateGate(input: CreateGateInput): Response | undefined {
  const { c, app, table, userRole, userGroups, guard } = input
  if (!guard) {
    const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
    return checkCreatePermission(table, effectiveRoles, c, app.tables)
  }
  if (passesTableRoleGate(table?.permissions, 'create', guard.effectiveRoles)) return undefined
  // Lack of read access collapses to 404 (enumeration safety).
  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return forbiddenCreateResponse(c)
}

/**
 * Z-3 create.when predicate check. The user's proposed row must satisfy
 * the predicate; out-of-scope creates return 403.
 */
function checkCreatePredicate(
  c: Context,
  table: Table | undefined,
  guard: RowLevelGuardContext | undefined,
  fields: Readonly<Record<string, unknown>>
): Response | undefined {
  if (!guard || !table?.rowLevelPermissions) return undefined
  if (recordPassesPredicate(table.rowLevelPermissions, 'create', fields, guard.current)) {
    return undefined
  }
  return forbiddenCreateScopeResponse(c)
}

interface UpdateGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly userRole: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext | undefined
}

/**
 * Z-3 update gate helper: enumeration-safe write role-gate. Per S1, all
 * authz denials return 404 so the write-permission boundary is not
 * discoverable — uniform with the read-deny path.
 */
function checkWriteRoleGate(
  c: Context,
  table: Table | undefined,
  guard: RowLevelGuardContext
): Response | undefined {
  if (passesTableRoleGate(table?.permissions, 'write', guard.effectiveRoles)) return undefined
  return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
}

interface WritePredicateInput {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext
}

/** Helper: evaluate write.when against an existing row. */
async function checkWritePredicate(input: WritePredicateInput): Promise<Response | undefined> {
  const { c, table, session, tableName, recordId, guard } = input
  if (!table?.rowLevelPermissions?.write?.when) return undefined
  const fetched = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  if (fetched._tag === 'Left' || !fetched.right) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return recordPassesPredicate(table.rowLevelPermissions, 'write', fetched.right, guard.current)
    ? undefined
    : c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
}

async function checkUpdateGateAndPredicate(input: UpdateGateInput): Promise<Response | undefined> {
  const { c, app, table, session, tableName, userRole, recordId, guard } = input

  if (!guard) {
    const permissionCheck = checkTableUpdatePermissionWithRole(app, tableName, userRole, c)
    return permissionCheck.allowed ? undefined : permissionCheck.response
  }

  return (
    checkWriteRoleGate(c, table, guard) ??
    (await checkWritePredicate({ c, table, session, tableName, recordId, guard }))
  )
}

/** Wave-1 realtime `insert`-event publish, tappable into the create pipeline. */
const publishInsertChange = (
  appId: string,
  tableName: string,
  record: { readonly id: string | number; readonly fields: Record<string, unknown> }
) =>
  Effect.sync(() =>
    publishRecordChange({
      appId,
      tableName,
      event: 'insert',
      recordId: record.id,
      record: { id: record.id, ...record.fields },
    })
  )

/**
 * Build the create-record Effect program: create row, tap matching
 * record-triggered automations. Tap errors are absorbed inside the
 * downstream use cases so an automation failure cannot mask a successful
 * record-create. Sequential `Effect.tap` chains so callers observing
 * downstream state (automation_runs) do not see a race window.
 */
function buildCreateRecordProgram(input: {
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly fields: Record<string, unknown>
  /** The user-supplied field map (pre baseline merge) — AI-compute override detection. */
  readonly incoming: Readonly<Record<string, unknown>>
  readonly app: App
  readonly userRole: string
  readonly origin: string
}) {
  const { session, tableName, fields, incoming, app, userRole, origin } = input
  return createRecordProgram({ session, tableName, fields, app, userRole, origin }).pipe(
    Effect.tap((record) => publishInsertChange(app.name, tableName, record)),
    Effect.tap((record) =>
      triggerRecordEventAutomations({
        app,
        tableName,
        event: 'create',
        record: { id: record.id, ...record.fields },
        processEnv: process.env,
        userId: session.userId,
      })
    ),
    Effect.tap((record) =>
      Effect.promise(() =>
        triggerTableWebhooks({
          table: app.tables?.find((t) => t.name === tableName),
          event: 'create',
          // `createdAt`/`updatedAt` are surfaced so webhooks configured with
          // `payload.includeMetadata` can expose them under `data.record`.
          record: {
            id: record.id,
            ...record.fields,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          },
        })
      )
    ),
    // [internal ref] Phase 2: signal the AI-compute write phase. A user override is
    // recorded as `skipped` (both dialects — the only signal for that case,
    // since the Postgres trigger short-circuits before NOTIFY); a computed
    // field is enqueued to the shared worker on SQLite (Postgres uses the NOTIFY
    // listener). Fire-and-forget; no-op for non-AI tables.
    Effect.tap((record) =>
      Effect.sync(() =>
        signalAiComputeWritePhase({
          app,
          tableName,
          op: 'insert',
          recordId: record.id,
          incoming,
          record: record.fields,
        })
      )
    )
  )
}

export async function handleCreateRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const result = await validateRequest(c, createRecordRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table, app)

  const gateError = checkCreateGate({ c, app, table, userRole, userGroups, guard })
  if (gateError) return gateError

  const validationLayer = createValidationLayer(app, tableName, userRole)
  const program = validateRecordCreation(result.data.fields).pipe(
    Effect.provide(validationLayer),
    provideStorageLive
  )
  const validationResult = await Effect.runPromise(program.pipe(Effect.either))

  if (validationResult._tag === 'Left') return formatValidationError(validationResult.left, c)

  const predicateError = checkCreatePredicate(c, table, guard, validationResult.right)
  if (predicateError) return predicateError

  // [internal ref] Phase 2 baseline: Postgres computes the AI-compute baseline in a
  // synchronous BEFORE trigger; SQLite has no procedural language, so the
  // deterministic baseline is merged into the field map here (in-process,
  // pre-insert) so it lands in the SAME write — the "never empty after write"
  // invariant. No-op when the table has no AI-compute fields, or on Postgres.
  const fields =
    table && isSqliteRuntime()
      ? {
          ...validationResult.right,
          ...applyAiComputeBaseline({ table, op: 'insert', incoming: validationResult.right }),
        }
      : validationResult.right

  return await runEffect(
    c,
    provideTableWithAutomationsLive(
      buildCreateRecordProgram({
        session,
        tableName,
        fields,
        incoming: validationResult.right,
        app,
        userRole,
        origin: new URL(c.req.url).origin,
      })
    ),
    createRecordResponseSchema,
    201
  )
}

/**
 * Handle form-based UPDATE (POST) with redirect
 *
 * Used for update forms rendered as <form method="POST">.
 * Performs the record update and redirects to the _redirect path from form body
 * (or back to the Referer URL if no redirect is specified).
 *
 * This synchronous-navigation approach ensures the database write completes
 * before the browser proceeds, eliminating race conditions in E2E tests and
 * providing reliable behavior for users on slow connections.
 */
/**
 * Z-3 form-update auth gate: row-level scoping when declared, canonical
 * role-only check otherwise. Extracted so handleFormUpdateRecord stays
 * under the 50-line/function limit.
 */
async function resolveFormUpdateAuth(input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly recordId: string
}): Promise<Response | undefined> {
  const { c, app, tableName, userRole, session, recordId } = input
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table, app)

  if (guard) {
    return enforceFormMutationGate({
      c,
      table,
      session,
      tableName,
      recordId,
      guard,
      op: 'write',
    })
  }
  const permissionCheck = checkTableUpdatePermissionWithRole(app, tableName, userRole, c)
  return permissionCheck.allowed ? undefined : permissionCheck.response
}

export async function handleFormUpdateRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const body = await c.req.parseBody()
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  // Extract field values from form body (exclude internal fields)
  const INTERNAL_FIELDS = new Set(['_redirect'])
  const fields = Object.fromEntries(
    Object.entries(body).filter(([key]) => !INTERNAL_FIELDS.has(key))
  )

  const readonlyValidation = validateUpdateReadonlyFields(fields, c)
  if (readonlyValidation) return readonlyValidation

  const recordId = c.req.param('recordId')!
  const authError = await resolveFormUpdateAuth({ c, app, tableName, userRole, session, recordId })
  if (authError) return authError

  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    fields
  )

  if (Object.keys(allowedData).length === 0) {
    return handleNoAllowedFields({ session, tableName, recordId, forbiddenFields, c })
  }

  return executeFormUpdate({
    session,
    tableName,
    recordId,
    allowedData,
    app,
    userRole,
    redirectPath,
    referer: c.req.header('referer'),
    c,
  })
}

/**
 * Execute update via form submission and redirect
 */
async function executeFormUpdate(config: {
  readonly session: Parameters<typeof updateRecordProgram>[0]
  readonly tableName: string
  readonly recordId: string
  readonly allowedData: Record<string, unknown>
  readonly app: App
  readonly userRole: string
  readonly redirectPath: string | undefined
  readonly referer: string | undefined
  readonly c: Context
}): Promise<Response> {
  const { session, tableName, recordId, allowedData, app, userRole, redirectPath, referer, c } =
    config
  try {
    const result = await runTableProgram(
      updateRecordProgram(session, tableName, recordId, { fields: allowedData, app, userRole })
    )

    if (result._tag === 'Left' || !result.right || Object.keys(result.right).length === 0) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    // Redirect to specified path, referer, or respond with JSON
    if (redirectPath && redirectPath.startsWith('/')) {
      return c.redirect(redirectPath, 302)
    }
    if (referer) {
      return c.redirect(referer, 302)
    }
    return c.json(result.right, 200)
  } catch (error) {
    return handleRouteError(c, error)
  }
}

/**
 * Run all pre-mutation update gates in order: the Z-3 role/predicate gate
 * then the field-`condition` read-only lock. Returns the first failing
 * response, or `undefined` when the update may proceed.
 */
async function checkUpdateGates(input: UpdateGateInput): Promise<Response | undefined> {
  const { c, table, session, tableName, recordId } = input
  const updateGateError = await checkUpdateGateAndPredicate(input)
  if (updateGateError) return updateGateError
  // Reject updates to records locked by a field `condition` (readOnly: true).
  return checkFieldConditionReadOnly({ c, table, session, tableName, recordId })
}

export async function handleUpdateRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, updateRecordRequestSchema)
  if (!result.success) return result.response

  // Check for readonly fields BEFORE permission checks
  const readonlyValidation = validateUpdateReadonlyFields(result.data.fields, c)
  if (readonlyValidation) return readonlyValidation

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(session, userRole, table, app)

  const gateError = await checkUpdateGates({
    c,
    app,
    table,
    session,
    tableName,
    userRole,
    recordId,
    guard,
  })
  if (gateError) return gateError

  // Extract fields from nested format
  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    result.data.fields
  )

  // Validate forbidden fields
  const forbiddenValidation = validateUpdateForbiddenFields(forbiddenFields, c)
  if (forbiddenValidation) return forbiddenValidation

  if (Object.keys(allowedData).length === 0) {
    return handleNoAllowedFields({
      session,
      tableName,
      recordId,
      forbiddenFields,
      c,
    })
  }

  // Per-value rules — column formats (`email`, `url`) plus `multi-select`
  // option membership and `maxSelections` — run on the update path with the
  // same shared rules the create path runs, so both verbs on this resource
  // enforce one contract. Inspects only the columns the payload supplies.
  const valueError = await validateUpdateFieldValues(app, tableName, userRole, allowedData)
  if (valueError) return formatValidationError(valueError, c)

  return executeUpdate({
    session,
    tableName,
    recordId,
    // `rich-text` columns are HTML-sanitized with the same shared rule the
    // create path runs, so both verbs leave the column in one state. Unlike
    // the guards above this TRANSFORMS the write, so it sits at the hand-off
    // itself — the sanitized map is what reaches the row.
    allowedData: await sanitizeUpdateRichTextFields(app, tableName, userRole, allowedData),
    app,
    userRole,
    clientUpdatedAt: result.data.updatedAt,
    c,
  })
}
