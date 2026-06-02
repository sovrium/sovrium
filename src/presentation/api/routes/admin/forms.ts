/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
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
import { provideAdminFormsLive } from '@/presentation/api/routes/admin/forms/effect-runner'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'


type FormsRouteContext = Context

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

async function handleListForms(c: FormsRouteContext, resolveApp: () => App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const { cursor, limit, search } = parseFormsListQuery(c)

  const outcome = await Effect.runPromise(
    BuildFormsList(app, { cursor, limit, search }).pipe(provideAdminFormsLive)
  )
  if (outcome._tag === 'ValidationFailed') {
    console.error('[admin] forms list response validation failed', outcome.error)
    return c.json(
      { success: false, message: 'Failed to build forms list', code: 'INTERNAL_ERROR' },
      500
    )
  }

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

async function handleFormDetail(c: FormsRouteContext, resolveApp: () => App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''
  if (!/^[a-z][a-z0-9-]*$/.test(formName) || formName.length > 64) {
    return c.json({ success: false, message: 'Invalid form name', code: 'BAD_REQUEST' }, 400)
  }

  const outcome = await Effect.runPromise(
    BuildFormDetail(app, formName).pipe(provideAdminFormsLive)
  )
  if (outcome._tag === 'NotFound') {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  if (outcome._tag === 'ValidationFailed') {
    console.error('[admin] form detail response validation failed', outcome.error)
    return c.json(
      { success: false, message: 'Failed to build form detail', code: 'INTERNAL_ERROR' },
      500
    )
  }

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


async function handleListSubmissions(
  c: FormsRouteContext,
  resolveApp: () => App
): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''

  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const parsedQuery = formsSubmissionsListQuerySchema.safeParse({
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    status: c.req.query('status'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    include_deleted: c.req.query('include_deleted'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const query = parsedQuery.data

  const outcome = await Effect.runPromise(
    BuildSubmissionsList({
      formName,
      includeDeleted: query.include_deleted,
      status: query.status,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit,
    }).pipe(provideAdminFormsLive)
  )
  if (outcome._tag === 'ValidationFailed') {
    console.error('[admin] submissions list response validation failed', outcome.error)
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

async function handleSubmissionDetail(
  c: FormsRouteContext,
  resolveApp: () => App
): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''
  const submissionId = c.req.param('submissionId') ?? ''

  const parsedQuery = formSubmissionDetailQuerySchema.safeParse({
    reveal: c.req.query('reveal'),
    audit: c.req.query('audit'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const query = parsedQuery.data

  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const actor = await resolveActor(session.userId)
  const isAdmin = actor.role === 'admin'
  const captureAllowed = process.env['ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED'] === 'true'

  const outcome = await Effect.runPromise(
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
    return c.json(bodyCaptureDisabledErrorSchema.parse({ error: 'body-capture-disabled' }), 403)
  }
  if (outcome._tag === 'ValidationFailed') {
    console.error('[admin] submission detail response validation failed', outcome.error)
    return c.json(
      { success: false, message: 'Failed to build submission detail', code: 'INTERNAL_ERROR' },
      500
    )
  }

  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_SUBMISSION_DETAIL_QUERIED,
    actor,
    resourceId: submissionId,
    severity: 'info',
    result: 'success',
  })

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

async function handleSubmissionsBulk(
  c: FormsRouteContext,
  resolveApp: () => App
): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''

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

  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const outcome = await Effect.runPromise(
    BuildSubmissionsBulk(formName, requestIds).pipe(provideAdminFormsLive)
  )
  if (outcome._tag === 'ValidationFailed') {
    console.error('[admin] submissions bulk response validation failed', outcome.error)
    return c.json(
      { success: false, message: 'Failed to build bulk response', code: 'INTERNAL_ERROR' },
      500
    )
  }

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

export function chainAdminFormsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return chainAdminFormsRoutesInternal(honoApp, resolveApp)
}

