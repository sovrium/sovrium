/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { signalAiComputeWritePhase } from '@/application/use-cases/ai-compute/enqueue-refinement'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import {
  createRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/write-record-programs'
import { isSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/domain/models/api/tables/records'
import { createRecordResponseSchema } from '@/domain/models/api/tables/tables'
import { applyAiComputeBaseline } from '@/domain/models/app/tables/ai-compute-apply-baseline'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  provideTableWithAutomationsLive,
  runTableProgram,
} from '@/infrastructure/layers/table-layer'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { publishRecordChange } from '@/infrastructure/realtime/record-change-publisher'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
import { runEffect, validateRequest } from '@/presentation/api/runtime'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import {
  validateRecordCreation,
  createValidationLayer,
  formatValidationError,
} from '@/presentation/api/tables/validation'
import { handleRouteError } from './error-handlers'
import {
  sanitizeUpdateRichTextFields,
  validateUpdateFieldValues,
  validateUpdateForbiddenFields,
  validateUpdateReadonlyFields,
} from './record-update-guards'
import { executeUpdate } from './record-update-handler'
import { filterAllowedFieldsWithRole, handleNoAllowedFields } from './record-update-permissions'
import {
  checkCreateGate,
  checkCreatePredicate,
  checkUpdateGates,
  resolveFormUpdateAuth,
} from './record-write-gates'
import { resolveGuardForTable } from './row-level-guard'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

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
      // effect-promise: total -- `triggerTableWebhooks` wraps its whole dispatch in a try/catch; a webhook endpoint that is down, slow or missing must never fail the record write that fired it.
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
    // listener). No-op for non-AI tables.
    //
    // Forked DETACHED rather than run on a fiber of its own: the work must
    // outlive this request (it is enqueue + status writes, not part of the
    // response), but it reads the SAME `AiService` this program was provided,
    // so nothing is rebuilt to carry it.
    Effect.tap((record) =>
      Effect.forkDetach(
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
  const program = provideDomain(
    c,
    validateRecordCreation(result.data.fields).pipe(Effect.provide(validationLayer))
  )
  const validationResult = await Effect.runPromise(program.pipe(Effect.result))

  if (validationResult._tag === 'Failure') return formatValidationError(validationResult.failure, c)

  const predicateError = checkCreatePredicate(c, table, guard, validationResult.success)
  if (predicateError) return predicateError

  // [internal ref] Phase 2 baseline: Postgres computes the AI-compute baseline in a
  // synchronous BEFORE trigger; SQLite has no procedural language, so the
  // deterministic baseline is merged into the field map here (in-process,
  // pre-insert) so it lands in the SAME write — the "never empty after write"
  // invariant. No-op when the table has no AI-compute fields, or on Postgres.
  const fields =
    table && isSqliteRuntime()
      ? {
          ...validationResult.success,
          ...applyAiComputeBaseline({ table, op: 'insert', incoming: validationResult.success }),
        }
      : validationResult.success

  return await runEffect(
    c,
    provideTableWithAutomationsLive(
      buildCreateRecordProgram({
        session,
        tableName,
        fields,
        incoming: validationResult.success,
        app,
        userRole,
        origin: new URL(c.req.url).origin,
      })
    ),
    createRecordResponseSchema,
    201
  )
}

export async function handleFormUpdateRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

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
  const authError = await resolveFormUpdateAuth({
    c,
    app,
    tableName,
    userRole,
    userGroups,
    session,
    recordId,
  })
  if (authError) return authError

  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    fields
  )

  if (Object.keys(allowedData).length === 0) {
    return handleNoAllowedFields({ recordId, forbiddenFields, app, c })
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

    if (result._tag === 'Failure' || !result.success || Object.keys(result.success).length === 0) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    // Redirect to specified path, referer, or respond with JSON. The path
    // arrives in the request body, so it is only honoured once proven
    // same-origin — otherwise it is an open redirect off this site.
    if (isSafeRedirectPath(redirectPath)) {
      return c.redirect(redirectPath, 302)
    }
    if (referer) {
      return c.redirect(referer, 302)
    }
    return c.json(result.success, 200)
  } catch (error) {
    return handleRouteError(c, error)
  }
}

export async function handleUpdateRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

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
    userGroups,
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
    return handleNoAllowedFields({ recordId, forbiddenFields, app, c })
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
