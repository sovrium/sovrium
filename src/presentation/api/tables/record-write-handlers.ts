/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { buildSystemSession } from '@/application/use-cases/automations/build-guest-session'
import { createRecordWithSideEffects } from '@/application/use-cases/tables/record-create-orchestration'
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
import { buildCreateAuthorshipOverrides } from '@/domain/models/app/tables/authorship-fields'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { createWebhooksFor } from '@/infrastructure/webhooks/table-write-webhooks'
import { validateRequest } from '@/presentation/api/runtime'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { flashDeclaredToast } from '@/presentation/api/runtime/form-flash'
import { respondWith, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import {
  validateRecordCreation,
  createValidationLayer,
  formatValidationError,
} from '@/presentation/api/tables/validation'
import { limitAnonymousCreate } from './anonymous-create-rate-limit'
import { normalizeFormUpdateFields } from './form-update-fields'
import {
  fieldConditionLock,
  sanitizedRichTextFields,
  updateValueViolation,
  validateUpdateForbiddenFields,
  validateUpdateReadonlyFields,
} from './record-update-guards'
import { updateResponse } from './record-update-handler'
import { filterAllowedFieldsWithRole, noAllowedFieldsResponse } from './record-update-permissions'
import {
  checkCreateGate,
  checkCreatePredicate,
  formUpdateAuth,
  updateGates,
} from './record-write-gates'
import { getLinkReader } from './relationship-rules'
import { guardForTable } from './row-level-guard'
import { checkGetReadGate } from './row-level-read-helpers'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

type TableSession = ReturnType<typeof getTableContext>['session']

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

/** The create a handler has decoded, before it is gated, validated and written. */
interface CreateRequest {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly table: Table | undefined
  readonly session: TableSession
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly authored: ReturnType<typeof authorOfCreate>
}

/** Gate, validate, write and answer a create, as one program. */
const createResponse = (request: CreateRequest) =>
  Effect.gen(function* () {
    const { c, app, tableName, table, session, userRole, userGroups, authored } = request
    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)
    const gateError = checkCreateGate({ c, app, table, userRole, userGroups, guard })
    if (gateError) return gateError

    const writer = { role: userRole, groups: userGroups, signedOut: isGuestSession(session.userId) }
    const validationLayer = createValidationLayer(app, tableName, { ...writer, id: session.userId })
    const validated = yield* Effect.result(
      validateRecordCreation(authored.fields).pipe(Effect.provide(validationLayer))
    )
    if (validated._tag === 'Failure') return formatValidationError(validated.failure, c)
    const predicateError = checkCreatePredicate(c, table, guard, validated.success)
    if (predicateError) return predicateError

    const create = createRecordWithSideEffects({
      ...{ session, writer: authored.writer, tableName, app, userRole, userGroups },
      fields: validated.success,
      linkReader: getLinkReader(c),
      origin: new URL(c.req.url).origin,
      isSqlite: isSqliteRuntime(),
      processEnv: process.env,
      dispatchWebhooks: createWebhooksFor(app, tableName),
    })
    // A caller who may not read the table files the record and is handed back
    // none of it — no value, and no id to address a record she cannot read.
    return yield* checkGetReadGate({ c, app, table, userRole, userGroups, guard }) === undefined
      ? respondWith(c, create, createRecordResponseSchema, 201)
      : respondWith(c, Effect.as(create, { created: 1 }), batchCreateRecordsResponseSchema, 201)
  })

export async function handleCreateRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const limited = limitAnonymousCreate(c, session.userId, tableName)
  if (limited) return limited

  const result = await validateRequest(c, createRecordRequestSchema)
  if (!result.success) return result.response
  const table = app.tables?.find((t) => t.name === tableName)
  return runHandlerEffect(
    c,
    createResponse({
      ...{ c, app, tableName, table, session, userRole, userGroups },
      authored: authorOfCreate(app, tableName, session, result.data.fields),
    })
  )
}

/** A native form's update, gated and validated, then written through the JSON verb's path. */
const formUpdateResponse = (request: {
  readonly c: Context
  readonly app: App
  readonly fields: Record<string, unknown>
  readonly redirectPath: string | undefined
}) =>
  Effect.gen(function* () {
    const { c, app, fields, redirectPath } = request
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const table = app.tables?.find((t) => t.name === tableName)
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
      (yield* formUpdateAuth({ ...gateInput, change: allowedData })) ??
      (yield* fieldConditionLock({ c, table, session, tableName, recordId }))
    if (authError) return authError

    if (Object.keys(allowedData).length === 0) {
      return yield* noAllowedFieldsResponse({ recordId, forbiddenFields, app, c })
    }

    // The form verb writes the same columns the JSON verb does, so it answers to
    // the same per-value rules — formats, `multi-select` options, a relationship's
    // `maxLinked`, attachment confinement — or it is the one door left open.
    const valueError = yield* updateValueViolation({
      c,
      app,
      tableName,
      userRole,
      fields: allowedData,
    })
    if (valueError) return formatValidationError(valueError, c)

    const sanitized = yield* sanitizedRichTextFields(app, tableName, writer, allowedData)
    const response = yield* updateResponse({
      ...{ session, tableName, recordId, app, userRole, c },
      allowedData: sanitized,
    })
    return redirectAfterFormUpdate({ c, app, tableName }, response, redirectPath)
  })

/**
 * Send the browser on after a natively posted update saved — back where it came
 * from carrying the toast its form declared, once (`form-flash.ts`). The form
 * writes through the SAME update the JSON verb runs, so its webhooks and
 * record-trigger automations fire, realtime subscribers hear of it,
 * `published_at` is stamped on first publication, and a replaced attachment's
 * file is deleted — whether or not the island had hydrated.
 */
function redirectAfterFormUpdate(
  at: Parameters<typeof flashDeclaredToast>[0],
  response: Response,
  redirectPath: string | undefined
): Response {
  if (response.status !== 200) return response
  const { c } = at
  // A path from the request body is honoured only once proven same-origin: no open redirect.
  if (isSafeRedirectPath(redirectPath)) return c.redirect(redirectPath, 302)
  const referer = c.req.header('referer')
  if (referer) flashDeclaredToast(at, new URL(referer, c.req.url).pathname)
  return referer ? c.redirect(referer, 302) : response
}

export async function handleFormUpdateRecord(c: Context, app: App) {
  const { tableName } = getTableContext(c)
  const body = await c.req.parseBody()
  // Field values from the form body, less `_redirect`, as the write should see them
  const { _redirect: redirect, ...posted } = body
  const table = app.tables?.find((t) => t.name === tableName)
  const fields = normalizeFormUpdateFields(table, posted)

  const readonlyValidation = validateUpdateReadonlyFields(fields, c)
  if (readonlyValidation) return readonlyValidation

  const redirectPath = typeof redirect === 'string' ? redirect : undefined
  return runHandlerEffect(c, formUpdateResponse({ c, app, fields, redirectPath }))
}

/** A JSON update, gated and validated, then written. */
const jsonUpdateResponse = (request: {
  readonly c: Context
  readonly app: App
  readonly requested: Record<string, unknown>
  readonly clientUpdatedAt: string | undefined
}) =>
  Effect.gen(function* () {
    const { c, app, requested, clientUpdatedAt } = request
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const table = app.tables?.find((t) => t.name === tableName)
    const recordId = c.req.param('recordId')!
    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)

    // The row-level gate reads the change the write will make, so a silently
    // dropped `user_id` never counts toward it.
    const writer = { role: userRole, groups: userGroups, signedOut: isGuestSession(session.userId) }
    const { allowedData: fields, forbiddenFields } = filterAllowedFieldsWithRole(
      app,
      tableName,
      writer,
      requested
    )
    const gateError = yield* updateGates({
      ...{ c, app, table, session, tableName, userRole, userGroups, recordId, guard },
      change: fields,
    })
    if (gateError) return gateError

    const forbiddenValidation = validateUpdateForbiddenFields(forbiddenFields, c)
    if (forbiddenValidation) return forbiddenValidation
    if (Object.keys(fields).length === 0) {
      return yield* noAllowedFieldsResponse({ recordId, forbiddenFields, app, c })
    }

    // Per-value rules — column formats (`email`, `url`), `multi-select` option
    // membership and `maxSelections`, and attachment-reference confinement — run
    // with the same shared rules the create path runs, so both verbs on this
    // resource enforce one contract. Inspects only the columns the payload supplies.
    const valueError = yield* updateValueViolation({ c, app, tableName, userRole, fields })
    if (valueError) return formatValidationError(valueError, c)

    // `rich-text` columns are HTML-sanitized with the same shared rule the create
    // path runs, so both verbs leave the column in one state. Unlike the guards
    // above this TRANSFORMS the write, so the sanitized map is what reaches the row.
    const allowedData = yield* sanitizedRichTextFields(app, tableName, writer, fields)
    return yield* updateResponse({
      ...{ session, tableName, recordId, allowedData, app, userRole, c },
      ...(clientUpdatedAt === undefined ? {} : { clientUpdatedAt }),
    })
  })

export async function handleUpdateRecord(c: Context, app: App) {
  const result = await validateRequest(c, updateRecordRequestSchema)
  if (!result.success) return result.response

  // Check for readonly fields BEFORE permission checks
  const readonlyValidation = validateUpdateReadonlyFields(result.data.fields, c)
  if (readonlyValidation) return readonlyValidation

  return runHandlerEffect(
    c,
    jsonUpdateResponse({
      c,
      app,
      requested: result.data.fields,
      clientUpdatedAt: result.data.updatedAt,
    })
  )
}
