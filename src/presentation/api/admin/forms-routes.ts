/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin endpoints for the forms domain.
 *
 * The READS below — the catalog, one form, one form's submissions, one
 * submission and the CSV export — are admin read-registry entries
 * (`application/use-cases/admin/forms-read-operations.ts`), mounted here through
 * `chainAdminReadRoutes`: the route, its OpenAPI operation and its MCP admin
 * tool are one entry. Only the bulk read (a POST) is hand-written in this file.
 *
 * Five endpoints, two route families:
 *
 *   1. Forms catalog (`app.forms[]` projection)
 *      - GET /api/admin/forms                            — cursor-paginated list
 *      - GET /api/admin/forms/:formName                  — single form detail
 *      Emits `form.list.queried` / `form.detail.queried` on success.
 *
 *   2. Form-submissions (`system.form_submissions` ledger)
 *      - GET  /api/admin/forms/:formName/submissions                     — list
 *      - GET  /api/admin/forms/:formName/submissions/:submissionId       — detail
 *      - POST /api/admin/forms/:formName/submissions/_bulk               — bulk read
 *      Emits `form.submission.{list,detail,bulk}.queried` on success; the
 *      detail handler additionally emits `form.submission.body.revealed`
 *      (severity: critical) when an admin successfully reveals the body
 *      via `?reveal=true` AND `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true`.
 *
 * Data access (the dialect-aware `form_submissions` reads) and all pure logic
 * (form/submission admin-item building, the two cursor encode/decode pairs,
 * forms-catalog pagination) live in the `forms-overview` use case + the
 * `admin-forms` repository; this handler keeps only HTTP, auth, form-name +
 * query validation, the 100-cap pre-screen, the bulk-body parsing, the D7
 * env/role gate resolution, the response-validation → status mapping, and the
 * audit emits, then calls the use cases via the effect runner.
 *
 * Auth gating is wired upstream by `requireAdminTier()` in
 * `middleware/admin-route-guards.ts`. Anti-enumeration 404
 * applies to every unauthorized-or-unknown path (keystone §6.4 / S1).
 */

import { Effect } from 'effect'
import { FORMS_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import { buildSubmissionsBulk } from '@/application/use-cases/admin/form-submissions-overview'
import { decodeOrThrow } from '@/domain/kernel/config-parsing/decode'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  formsSubmissionsBulkRequestSchema,
  formsSubmissionsBulkResponseSchema,
  tooManyIdsErrorSchema,
} from '@/domain/models/api/admin/forms/submissions-bulk'
import { logError } from '@/infrastructure/logging/logger'
import { emitAuditEventAs } from '@/presentation/api/admin/audit-events'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import { decodeJsonBody } from '@/presentation/api/runtime/request-body'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/** Hono context of the forms routes. */
type FormsRouteContext = Context

/**
 * Forms route module — wires every endpoint over the one App.
 */
function chainAdminFormsRoutesInternal<T extends Hono>(honoApp: T, app: App): T {
  return chainAdminReadRoutes(honoApp, app, FORMS_READ_OPERATIONS).post(
    '/api/admin/forms/:formName/submissions/_bulk',
    (c) => handleSubmissionsBulk(c, app)
  ) as T
}

/**
 * POST /api/admin/forms/:formName/submissions/_bulk — bulk read by id array.
 */
async function handleSubmissionsBulk(c: FormsRouteContext, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const formName = c.req.param('formName') ?? ''

  // Read raw JSON body so we can pre-screen the 100-cap BEFORE validating
  // against the strict request schema (the schema's .max(100) would conflate
  // "too many" with "shape invalid"; D8 mandates a stable error code).
  const { raw: bodyRaw, decoded: parsedRequest } = await decodeJsonBody(
    c,
    formsSubmissionsBulkRequestSchema
  )
  if (bodyRaw === undefined) {
    return c.json({ success: false, message: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }
  const idsRaw = (bodyRaw as { readonly ids?: unknown } | null)?.ids
  if (Array.isArray(idsRaw) && idsRaw.length > 100) {
    return c.json(decodeOrThrow(tooManyIdsErrorSchema)({ error: 'too-many-ids' }), 400)
  }

  if (!parsedRequest.success) {
    return c.json({ success: false, message: 'Invalid bulk request', code: 'BAD_REQUEST' }, 400)
  }
  const requestIds = parsedRequest.data.ids

  // Form must exist — anti-enum 404 otherwise.
  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return notFound(c, 'Not found')
  }

  return runHandlerEffect(
    c,
    answerFailures(c, bulkReadProgram(c, session.userId, formName, requestIds))
  )
}

/** Read the submissions, write the ONE audit entry of the call, answer through the contract. */
const bulkReadProgram = (
  c: FormsRouteContext,
  userId: string,
  formName: string,
  ids: readonly string[]
) =>
  Effect.gen(function* () {
    const outcome = yield* buildSubmissionsBulk(formName, ids)
    if (outcome._tag === 'ValidationFailed') {
      logError(
        '[admin] submissions bulk response validation failed',
        outcome.error,
        requestLogAttributes(c)
      )
      return c.json(
        { success: false, message: 'Failed to build bulk response', code: 'INTERNAL_ERROR' },
        500
      )
    }

    // ONE audit emit per call (NOT one per id) — log-storm prevention.
    yield* emitAuditEventAs(userId, {
      action: AUDIT_ACTIONS.FORM_SUBMISSION_BULK_QUERIED,
      resourceId: formName,
      severity: 'info',
      result: 'success',
    })

    return yield* respondWith(c, Effect.succeed(outcome.body), formsSubmissionsBulkResponseSchema)
  })

/**
 * Chain the admin/forms routes onto a Hono app. Auth gating is applied
 * upstream in `createApiRoutes` (authMiddleware + requireAdminTier).
 *
 * The reads come from the registry, which lists the export before the
 * one-submission read so `/submissions/export` is never captured as a
 * submission id; the bulk POST shadows no GET.
 */
export function chainAdminFormsRoutes<T extends Hono>(honoApp: T, app: App): T {
  return chainAdminFormsRoutesInternal(honoApp, app)
}
