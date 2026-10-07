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
 * `infrastructure/server/route-setup/api-routes.ts`. Anti-enumeration 404
 * applies to every unauthorized-or-unknown path (keystone §6.4 / S1).
 */

import { FORMS_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import { BuildSubmissionsBulk } from '@/application/use-cases/admin/forms-overview'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  formsSubmissionsBulkRequestSchema,
  tooManyIdsErrorSchema,
} from '@/domain/models/api/admin/forms/submissions-bulk'
import { decodeOrThrow, decodeSafe } from '@/domain/models/api/combinators/decode'
import { logError } from '@/infrastructure/logging/logger'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { emitAuditEvent } from '@/presentation/api/admin/audit-events'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/* eslint-disable max-lines-per-function, max-statements -- request-handler code: Hono handlers compose query validation, the use-case call, the response-status mapping, and the audit emit(s) as intentional side-effects; the per-handler statement/line counts exceed the default cap. Matches the sibling admin route handlers. */

/**
 * Hono context augmented with the live-App resolver. Routes call
 * `resolveApp()` to read the App config; falls back to the boot App when
 * no draft has been published.
 */
type FormsRouteContext = Context

/**
 * Forms route module — wires every endpoint and shares the live-App resolver.
 *
 * The closure-based design keeps the live-App accessor isolated to this
 * module without polluting Hono's `c.var` namespace.
 */
function chainAdminFormsRoutesInternal<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return chainAdminReadRoutes(honoApp, resolveApp, FORMS_READ_OPERATIONS).post(
    '/api/admin/forms/:formName/submissions/_bulk',
    (c) => handleSubmissionsBulk(c, resolveApp)
  ) as T
}

/**
 * POST /api/admin/forms/:formName/submissions/_bulk — bulk read by id array.
 */
async function handleSubmissionsBulk(
  c: FormsRouteContext,
  resolveApp: () => App
): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''

  // Read raw JSON body so we can pre-screen the 100-cap BEFORE validating
  // against the strict request schema (the schema's .max(100) would conflate
  // "too many" with "shape invalid"; D8 mandates a stable error code).
  let bodyRaw: unknown
  try {
    bodyRaw = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }
  const idsRaw = (bodyRaw as { readonly ids?: unknown })?.ids
  if (Array.isArray(idsRaw) && idsRaw.length > 100) {
    return c.json(decodeOrThrow(tooManyIdsErrorSchema)({ error: 'too-many-ids' }), 400)
  }

  const parsedRequest = decodeSafe(formsSubmissionsBulkRequestSchema)(bodyRaw)
  if (!parsedRequest.success) {
    return c.json({ success: false, message: 'Invalid bulk request', code: 'BAD_REQUEST' }, 400)
  }
  const requestIds = parsedRequest.data.ids

  // Form must exist — anti-enum 404 otherwise.
  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return notFound(c, 'Not found')
  }

  const outcome = await runRequestEffect(
    c,
    provideDomain(c, BuildSubmissionsBulk(formName, requestIds))
  )
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
  const actor = await runDomainPromise(c, resolveActor(session.userId))
  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_SUBMISSION_BULK_QUERIED,
    actor,
    resourceId: formName,
    severity: 'info',
    result: 'success',
  })

  return c.json(outcome.body, 200)
}

/**
 * Chain the admin/forms routes onto a Hono app. Auth gating is applied
 * upstream in `createApiRoutes` (authMiddleware + requireAdminTier).
 *
 * The reads come from the registry, which lists the export before the
 * one-submission read so `/submissions/export` is never captured as a
 * submission id; the bulk POST shadows no GET.
 */
export function chainAdminFormsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return chainAdminFormsRoutesInternal(honoApp, resolveApp)
}

/* eslint-enable max-lines-per-function, max-statements */
