/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { signalAiComputeWritePhase } from '@/application/use-cases/ai-compute/enqueue-refinement'
import { buildSystemSession } from '@/application/use-cases/automations/build-guest-session'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { createRecordProgram } from '@/application/use-cases/tables/write-record-programs'
import { isSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/domain/models/api/tables/records'
import {
  batchCreateRecordsResponseSchema,
  createRecordResponseSchema,
} from '@/domain/models/api/tables/tables'
import { isGuestSession, SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import { applyAiComputeBaseline } from '@/domain/models/app/tables/ai-compute-apply-baseline'
import { buildCreateAuthorshipOverrides } from '@/domain/models/app/tables/authorship-fields'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { provideTableWithAutomationsLive } from '@/infrastructure/layers/table-layer'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
import { runEffect, validateRequest } from '@/presentation/api/runtime'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import {
  validateRecordCreation,
  createValidationLayer,
  formatValidationError,
} from '@/presentation/api/tables/validation'
import { limitAnonymousCreate } from './anonymous-create-rate-limit'
import { normalizeFormUpdateFields } from './form-update-fields'
import {
  checkFieldConditionReadOnly,
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
import { getLinkReader } from './relationship-rules'
import { resolveGuardForTable } from './row-level-guard'
import { checkGetReadGate } from './row-level-read-helpers'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type TableSession = ReturnType<typeof getTableContext>['session']

interface CreateRecordProgramInput {
  readonly session: TableSession
  readonly writer: TableSession
  readonly tableName: string
  readonly fields: Record<string, unknown>
  /** The user-supplied field map (pre baseline merge) — AI-compute override detection. */
  readonly incoming: Readonly<Record<string, unknown>>
  readonly app: App
  readonly userRole: string
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups: readonly string[]
  /** The caller a link target is judged as — a visitor's record included. */
  readonly linkReader: LinkReader
  readonly origin: string
}

/**
 * Fire the table's `create` webhooks for a record just written (fire-and-forget).
 * `createdAt`/`updatedAt` are surfaced so webhooks configured with
 * `payload.includeMetadata` can expose them under `data.record`.
 */
function fireCreateWebhooks(
  app: App,
  tableName: string,
  record: {
    readonly id: unknown
    readonly fields: Record<string, unknown>
    readonly createdAt?: unknown
    readonly updatedAt?: unknown
  }
): Effect.Effect<void> {
  // effect-promise: total -- `triggerTableWebhooks` wraps its whole dispatch in a try/catch; a webhook endpoint that is down, slow or missing must never fail the record write that fired it.
  return Effect.promise(() =>
    triggerTableWebhooks({
      table: app.tables?.find((t) => t.name === tableName),
      appEnv: app.env,
      event: 'create',
      record: {
        id: record.id,
        ...record.fields,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    })
  )
}

/**
 * Build the create-record Effect program: create row, tap matching
 * record-triggered automations. Tap errors are absorbed inside the
 * downstream use cases so an automation failure cannot mask a successful
 * record-create. Sequential `Effect.tap` chains so callers observing
 * downstream state (automation_runs) do not see a race window. The row is
 * written as `writer` — the system for a signed-out visitor — while the
 * automations it starts still see the caller's own `session`.
 */
function buildCreateRecordProgram(input: CreateRecordProgramInput) {
  const { session, writer, tableName, fields, incoming, app, userRole, linkReader, origin } = input
  return createRecordProgram({
    session: writer,
    tableName,
    fields,
    app,
    userRole,
    userGroups: input.userGroups,
    origin,
    // A visitor's record is written by the system and judged as the visitor.
    linkReader,
  }).pipe(
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
    Effect.tap((record) => fireCreateWebhooks(app, tableName, record)),
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

/**
 * Who a create is written as, and the fields it may name about its author.
 *
 * A visitor who is not signed in has no account to name, so a record they
 * create on a `create: all` table is authored by the system — the same actor a
 * public form submission or an automation writes as — and any authorship value
 * they send is dropped rather than kept. A signed-in caller, and an app with no
 * sign-in at all, are written as themselves.
 */
function authorOfCreate(
  app: App,
  tableName: string,
  session: TableSession,
  fields: Readonly<Record<string, unknown>>
): { readonly writer: TableSession; readonly fields: Record<string, unknown> } {
  if (app.auth === undefined || !isGuestSession(session.userId)) {
    return { writer: session, fields: { ...fields } }
  }
  const authorship = new Set([
    ...Object.keys(buildCreateAuthorshipOverrides(app.tables, tableName, SYSTEM_USER_ID)),
    'created_by',
    'updated_by',
  ])
  return {
    writer: buildSystemSession(),
    fields: Object.fromEntries(Object.entries(fields).filter(([name]) => !authorship.has(name))),
  }
}

export async function handleCreateRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const limited = limitAnonymousCreate(c, session.userId, tableName)
  if (limited) return limited

  const result = await validateRequest(c, createRecordRequestSchema)
  if (!result.success) return result.response
  const authored = authorOfCreate(app, tableName, session, result.data.fields)

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, { userRole, userGroups }, table, app)

  const gateError = checkCreateGate({ c, app, table, userRole, userGroups, guard })
  if (gateError) return gateError

  const validationLayer = createValidationLayer(app, tableName, {
    role: userRole,
    groups: userGroups,
    signedOut: isGuestSession(session.userId),
  })
  const program = provideDomain(
    c,
    validateRecordCreation(authored.fields).pipe(Effect.provide(validationLayer))
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

  const create = provideTableWithAutomationsLive(
    buildCreateRecordProgram({
      session,
      writer: authored.writer,
      tableName,
      fields,
      incoming: validationResult.success,
      app,
      userRole,
      userGroups,
      linkReader: getLinkReader(c),
      origin: new URL(c.req.url).origin,
    })
  )
  // A caller who may not read the table files the record and is handed back
  // none of it — no value, and no id to address a record she cannot read.
  return checkGetReadGate({ c, app, table, userRole, userGroups, guard }) === undefined
    ? runEffect(c, create, createRecordResponseSchema, 201)
    : runEffect(c, Effect.as(create, { created: 1 }), batchCreateRecordsResponseSchema, 201)
}

export async function handleFormUpdateRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const body = await c.req.parseBody()
  // Field values from the form body, less `_redirect`, as the write should see them
  const { _redirect: redirect, ...posted } = body
  const redirectPath = typeof redirect === 'string' ? redirect : undefined
  const table = app.tables?.find((t) => t.name === tableName)
  const fields = normalizeFormUpdateFields(table, posted)

  const readonlyValidation = validateUpdateReadonlyFields(fields, c)
  if (readonlyValidation) return readonlyValidation

  const recordId = c.req.param('recordId')!
  // The row-level gate reads the change the save will actually make: a field the
  // role may not write is dropped below, so it never counts toward the check.
  const writer = { role: userRole, groups: userGroups, signedOut: isGuestSession(session.userId) }
  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    writer,
    fields
  )
  const gateInput = { c, app, tableName, userRole, userGroups, session, recordId }
  const authError =
    (await resolveFormUpdateAuth({ ...gateInput, change: allowedData })) ??
    (await checkFieldConditionReadOnly({ c, table, session, tableName, recordId }))
  if (authError) return authError

  if (Object.keys(allowedData).length === 0) {
    return handleNoAllowedFields({ recordId, forbiddenFields, app, c })
  }

  // The form verb writes the same columns the JSON verb does, so it answers to
  // the same per-value rules — formats, `multi-select` options, a relationship's
  // `maxLinked`, attachment confinement — or it is the one door left open.
  const valueError = await validateUpdateFieldValues({
    c,
    app,
    tableName,
    userRole,
    fields: allowedData,
  })
  if (valueError) return formatValidationError(valueError, c)

  return executeFormUpdate({
    session,
    tableName,
    recordId,
    allowedData: await sanitizeUpdateRichTextFields(app, tableName, writer, allowedData),
    app,
    userRole,
    redirectPath,
    referer: c.req.header('referer'),
    c,
  })
}

/**
 * Save a natively posted update through the SAME write the JSON verb runs, then
 * send the browser on.
 *
 * `executeUpdate` is where an update becomes more than a row write: its
 * webhooks and record-trigger automations fire, realtime subscribers hear of
 * it, `published_at` is stamped on first publication, and a replaced
 * attachment's file is deleted. A form that wrote the row through the bare
 * program skipped every one of them, so the same edit behaved differently
 * depending on whether the island had hydrated.
 */
async function executeFormUpdate(config: {
  readonly session: Parameters<typeof executeUpdate>[0]['session']
  readonly tableName: string
  readonly recordId: string
  readonly allowedData: Record<string, unknown>
  readonly app: App
  readonly userRole: string
  readonly redirectPath: string | undefined
  readonly referer: string | undefined
  readonly c: Context
}): Promise<Response> {
  const { redirectPath, referer, c, ...update } = config
  const response = await executeUpdate({ ...update, c })
  if (response.status !== 200) return response
  // The path arrives in the request body, so it is only honoured once proven
  // same-origin — otherwise it is an open redirect off this site.
  if (isSafeRedirectPath(redirectPath)) return c.redirect(redirectPath, 302)
  if (referer) return c.redirect(referer, 302)
  return response
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
  const guard = await resolveGuardForTable(session, { userRole, userGroups }, table, app)

  // Extract fields from nested format. The row-level gate reads the change the
  // write will make, so a silently dropped `user_id` never counts toward it.
  const writer = { role: userRole, groups: userGroups, signedOut: isGuestSession(session.userId) }
  const { allowedData: fields, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    writer,
    result.data.fields
  )

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
    change: fields,
  })
  if (gateError) return gateError

  // Validate forbidden fields
  const forbiddenValidation = validateUpdateForbiddenFields(forbiddenFields, c)
  if (forbiddenValidation) return forbiddenValidation

  if (Object.keys(fields).length === 0) {
    return handleNoAllowedFields({ recordId, forbiddenFields, app, c })
  }

  // Per-value rules — column formats (`email`, `url`), `multi-select`
  // option membership and `maxSelections`, and attachment-reference
  // confinement — run on the update path with the
  // same shared rules the create path runs, so both verbs on this resource
  // enforce one contract. Inspects only the columns the payload supplies.
  const valueError = await validateUpdateFieldValues({ c, app, tableName, userRole, fields })
  if (valueError) return formatValidationError(valueError, c)

  return executeUpdate({
    session,
    tableName,
    recordId,
    // `rich-text` columns are HTML-sanitized with the same shared rule the
    // create path runs, so both verbs leave the column in one state. Unlike
    // the guards above this TRANSFORMS the write, so it sits at the hand-off
    // itself — the sanitized map is what reaches the row.
    allowedData: await sanitizeUpdateRichTextFields(app, tableName, writer, fields),
    app,
    userRole,
    clientUpdatedAt: result.data.updatedAt,
    c,
  })
}
