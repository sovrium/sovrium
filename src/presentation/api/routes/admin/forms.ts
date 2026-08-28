/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin endpoints for the forms domain.
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

import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import {
  BuildFormDetail,
  BuildFormsList,
  BuildSubmissionDetail,
  BuildSubmissionsBulk,
  BuildSubmissionsList,
} from '@/application/use-cases/admin/forms-overview'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  bodyCaptureDisabledErrorSchema,
  formSubmissionDetailQuerySchema,
} from '@/domain/models/api/admin/forms/submission-detail'
import {
  formsSubmissionsBulkRequestSchema,
  tooManyIdsErrorSchema,
} from '@/domain/models/api/admin/forms/submissions-bulk'
import { formsSubmissionsListQuerySchema } from '@/domain/models/api/admin/forms/submissions-list'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideAdminFormsLive } from '@/presentation/api/routes/admin/forms/effect-runner'
import { requestLogAttributes } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/* eslint-disable functional/no-expression-statements, functional/no-let, max-lines-per-function, max-statements -- request-handler code: Hono handlers compose query validation, the use-case call, the response-status mapping, and the audit emit(s) as intentional side-effects; the per-handler statement/line counts exceed the default cap. Matches the sibling admin route handlers. */

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
  return honoApp
    .get('/api/admin/forms', (c) => handleListForms(c, resolveApp))
    .get('/api/admin/forms/:formName/submissions/:submissionId', (c) =>
      handleSubmissionDetail(c, resolveApp)
    )
    .post('/api/admin/forms/:formName/submissions/_bulk', (c) =>
      handleSubmissionsBulk(c, resolveApp)
    )
    .get('/api/admin/forms/:formName/submissions', (c) => handleListSubmissions(c, resolveApp))
    .get('/api/admin/forms/:formName', (c) => handleFormDetail(c, resolveApp)) as T
}

/** Parse list-endpoint query params with sensible defaults. */
function parseFormsListQuery(c: Context): {
  readonly cursor: string | undefined
  readonly limit: number
  readonly search: string | undefined
} {
  const cursor = c.req.query('cursor')
  const limitRaw = Number(c.req.query('limit') ?? '50')
  const limit = Number.isFinite(limitRaw) && limitRaw >= 1 && limitRaw <= 200 ? limitRaw : 50
  const searchRaw = c.req.query('search')
  const search = typeof searchRaw === 'string' && searchRaw.length > 0 ? searchRaw : undefined
  return { cursor, limit, search }
}

/**
 * GET /api/admin/forms — cursor-paginated list of admin form items.
 */
async function handleListForms(c: FormsRouteContext, resolveApp: () => App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const { cursor, limit, search } = parseFormsListQuery(c)

  // Build the list body (config-backed pagination + per-form aggregate reads)
  // via the use case.
  const outcome = await runRequestEffect(
    c,
    BuildFormsList(app, { cursor, limit, search }).pipe(provideAdminFormsLive)
  )
  if (outcome._tag === 'ValidationFailed') {
    logError(
      '[admin] forms list response validation failed',
      outcome.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build forms list', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit audit entry. Resource id is the app name — the forms catalog is a
  // single virtual resource scoped to the active app.
  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_LIST_QUERIED,
    actor,
    resourceId: app.name,
    severity: 'info',
    result: 'success',
  })

  return c.json(outcome.body, 200)
}

/**
 * GET /api/admin/forms/:formName — single form detail.
 */
async function handleFormDetail(c: FormsRouteContext, resolveApp: () => App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''
  if (!/^[a-z][a-z0-9-]*$/.test(formName) || formName.length > 64) {
    return c.json({ success: false, message: 'Invalid form name', code: 'BAD_REQUEST' }, 400)
  }

  const outcome = await runRequestEffect(
    c,
    BuildFormDetail(app, formName).pipe(provideAdminFormsLive)
  )
  if (outcome._tag === 'NotFound') {
    // Anti-enumeration 404 — unknown form name within an authorized tier.
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  if (outcome._tag === 'ValidationFailed') {
    logError(
      '[admin] form detail response validation failed',
      outcome.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build form detail', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit audit entry. Resource id is the form name (admin endpoints use the
  // human-readable identifier as resource.id for consistency).
  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_DETAIL_QUERIED,
    actor,
    resourceId: formName,
    severity: 'info',
    result: 'success',
  })

  return c.json(outcome.body, 200)
}

// ---------------------------------------------------------------------------
// Form submissions endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/forms/:formName/submissions — list submissions for a form.
 */
async function handleListSubmissions(
  c: FormsRouteContext,
  resolveApp: () => App
): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''

  // The form must exist in the live app for the list endpoint to serve it
  // (anti-enum 404 if the form is unknown — same contract as the detail
  // endpoint above).
  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  // Parse the query string against the canonical schema (so the cursor,
  // limit, status, from/to, include_deleted defaults all apply).
  //
  // This object literal is an ALLOW-LIST: Hono drops any parameter not named
  // here without complaint, so a request carrying an unlisted knob comes back
  // as a confident 200 over the unfiltered first page. `q` was exactly that
  // omission. NOT to be confused with the forms CATALOG endpoint's `?search`,
  // which filters form names and has never touched submissions.
  const parsedQuery = formsSubmissionsListQuerySchema.safeParse({
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    status: c.req.query('status'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    include_deleted: c.req.query('include_deleted'),
    q: c.req.query('q'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const query = parsedQuery.data

  const outcome = await runRequestEffect(
    c,
    BuildSubmissionsList({
      formName,
      includeDeleted: query.include_deleted,
      status: query.status,
      from: query.from,
      to: query.to,
      q: query.q,
      cursor: query.cursor,
      limit: query.limit,
    }).pipe(provideAdminFormsLive)
  )
  if (outcome._tag === 'ValidationFailed') {
    logError(
      '[admin] submissions list response validation failed',
      outcome.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build submissions list', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_SUBMISSION_LIST_QUERIED,
    actor,
    resourceId: formName,
    severity: 'info',
    result: 'success',
  })

  return c.json(outcome.body, 200)
}

/**
 * GET /api/admin/forms/:formName/submissions/:submissionId — detail
 * endpoint with optional `?reveal=true` body capture and `?audit=N` inline
 * audit trail.
 */
async function handleSubmissionDetail(
  c: FormsRouteContext,
  resolveApp: () => App
): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''
  const submissionId = c.req.param('submissionId') ?? ''

  // Parse query (audit cap 50, reveal boolean).
  const parsedQuery = formSubmissionDetailQuerySchema.safeParse({
    reveal: c.req.query('reveal'),
    audit: c.req.query('audit'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const query = parsedQuery.data

  // Form must exist — anti-enum 404 otherwise.
  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  // Resolve actor role for the D7 reveal gate (env-var + admin-role predicates
  // are HTTP/auth concerns resolved here; the use case consumes the booleans).
  const actor = await resolveActor(session.userId)
  const isAdmin = isAdminRole(actor.role)
  const captureAllowed = process.env['ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED'] === 'true'

  const outcome = await runRequestEffect(
    c,
    BuildSubmissionDetail({
      formName,
      submissionId,
      reveal: query.reveal,
      captureAllowed,
      isAdmin,
    }).pipe(provideAdminFormsLive)
  )

  if (outcome._tag === 'NotFound') {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  if (outcome._tag === 'RevealDenied') {
    // 403 OK: operator-level feature gate (env-var policy) or admin-only
    // reveal — caller already has admin-tier list visibility; 403 surfaces
    // the policy gate without enabling resource enumeration.
    return c.json(bodyCaptureDisabledErrorSchema.parse({ error: 'body-capture-disabled' }), 403)
  }
  if (outcome._tag === 'ValidationFailed') {
    logError(
      '[admin] submission detail response validation failed',
      outcome.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build submission detail', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit `form.submission.detail.queried` for every successful detail read.
  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_SUBMISSION_DETAIL_QUERIED,
    actor,
    resourceId: submissionId,
    severity: 'info',
    result: 'success',
  })

  // Additionally emit `form.submission.body.revealed` (severity: critical)
  // when the body was actually included in the response.
  if (outcome.bodyRevealed) {
    await emitAuditEvent({
      action: AUDIT_ACTIONS.FORM_SUBMISSION_BODY_REVEALED,
      actor,
      resourceId: submissionId,
      severity: 'critical',
      result: 'success',
    })
  }

  return c.json(outcome.body, 200)
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
    return c.json(tooManyIdsErrorSchema.parse({ error: 'too-many-ids' }), 400)
  }

  const parsedRequest = formsSubmissionsBulkRequestSchema.safeParse(bodyRaw)
  if (!parsedRequest.success) {
    return c.json({ success: false, message: 'Invalid bulk request', code: 'BAD_REQUEST' }, 400)
  }
  const requestIds = parsedRequest.data.ids

  // Form must exist — anti-enum 404 otherwise.
  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const outcome = await runRequestEffect(
    c,
    BuildSubmissionsBulk(formName, requestIds).pipe(provideAdminFormsLive)
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
  const actor = await resolveActor(session.userId)
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
 * Route order matters — more-specific submission paths register first so
 * they take precedence over the bare list/detail forms paths (Hono matches
 * in registration order on overlapping `.get`).
 */
export function chainAdminFormsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return chainAdminFormsRoutesInternal(honoApp, resolveApp)
}

/* eslint-enable functional/no-expression-statements, functional/no-let, max-lines-per-function, max-statements */
