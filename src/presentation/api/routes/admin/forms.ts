/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { and, count, desc, eq, gt, inArray, isNull, lt, max } from 'drizzle-orm'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  formAdminDetailResponseSchema,
  formsListResponseSchema,
  type FormAdminItem,
} from '@/domain/models/api/admin/forms/list'
import {
  bodyCaptureDisabledErrorSchema,
  formSubmissionDetailQuerySchema,
  formSubmissionDetailResponseSchema,
} from '@/domain/models/api/admin/forms/submission-detail'
import {
  formsSubmissionsBulkRequestSchema,
  formsSubmissionsBulkResponseSchema,
  tooManyIdsErrorSchema,
} from '@/domain/models/api/admin/forms/submissions-bulk'
import {
  formsSubmissionsListQuerySchema,
  formsSubmissionsListResponseSchema,
  type FormSubmissionAdminItem,
  type FormSubmissionStatus,
} from '@/domain/models/api/admin/forms/submissions-list'
import { db } from '@/infrastructure/database'
import { formSubmissionsTable } from '@/infrastructure/database/drizzle/dialect-schema'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
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

function resolveAccessLevel(form: Form): 'public' | 'authenticated' | 'role-restricted' {
  const require = form.access?.require
  if (require === undefined || require === 'all') return 'public'
  if (require === 'authenticated') return 'authenticated'
  return 'role-restricted'
}

function resolveIsOpen(form: Form): boolean {
  const availability = form.availability
  if (!availability) return true
  const now = Date.now()
  if (availability.opensAt) {
    const opens = Date.parse(availability.opensAt)
    if (!Number.isNaN(opens) && now < opens) return false
  }
  if (availability.closesAt) {
    const closes = Date.parse(availability.closesAt)
    if (!Number.isNaN(closes) && now >= closes) return false
  }
  return true
}

async function buildFormAdminItem(form: Form): Promise<FormAdminItem> {
  const submissions = formSubmissionsTable()
  const aggregateResult = (await db
    .select({
      submissionCount: count(),
      lastSubmissionAt: max(submissions.submittedAt),
    })
    .from(submissions)
    .where(
      and(eq(submissions.formName, form.name), isNull(submissions.deletedAt))
    )) as ReadonlyArray<{
    readonly submissionCount: number | string
    readonly lastSubmissionAt: Date | string | null
  }>
  const row = aggregateResult[0]
  const submissionCount = Number(row?.submissionCount ?? 0)
  const lastSubmissionRaw = row?.lastSubmissionAt ?? null
  const lastSubmissionAt =
    lastSubmissionRaw === null
      ? null
      : lastSubmissionRaw instanceof Date
        ? lastSubmissionRaw.toISOString()
        : new Date(lastSubmissionRaw).toISOString()

  const item: FormAdminItem = {
    id: form.id,
    name: form.name,
    title: form.title,
    ...(form.path !== undefined ? { path: form.path } : {}),
    accessLevel: resolveAccessLevel(form),
    isOpen: resolveIsOpen(form),
    _admin: {
      lastModifiedBy: null,
      deletedAt: null,
      metadata: {
        fieldCount: form.fields.length,
        submissionCount,
        lastSubmissionAt,
      },
    },
  }
  return item
}

function encodeFormsCursor(afterName: string): string {
  return Buffer.from(JSON.stringify({ afterName }), 'utf8').toString('base64')
}

function decodeFormsCursor(
  cursor: string,
  forms: ReadonlyArray<{ readonly name: string }>
): number {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly afterName?: unknown
    }
    if (typeof decoded.afterName !== 'string') return 0
    const idx = forms.findIndex((f) => f.name === decoded.afterName)
    return idx === -1 ? 0 : idx + 1
  } catch {
    return 0
  }
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
  const allForms: readonly Form[] = (app.forms ?? []).slice()
  const sortedForms = allForms.toSorted((a, b) => a.name.localeCompare(b.name))

  const { cursor, limit, search } = parseFormsListQuery(c)
  const filtered = search
    ? sortedForms.filter((f) => {
        const haystack = `${f.name} ${f.title}`.toLowerCase()
        return haystack.includes(search.toLowerCase())
      })
    : sortedForms

  const startIndex = cursor ? decodeFormsCursor(cursor, filtered) : 0
  const pageSlice = filtered.slice(startIndex, startIndex + limit)
  const nextStart = startIndex + pageSlice.length
  const nextCursor =
    nextStart < filtered.length && pageSlice.length > 0
      ? encodeFormsCursor(pageSlice[pageSlice.length - 1]!.name)
      : null

  const items = await Promise.all(pageSlice.map((form) => buildFormAdminItem(form)))

  const body = { items, nextCursor }
  const parsed = formsListResponseSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[admin] forms list response validation failed', parsed.error)
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

  return c.json(parsed.data, 200)
}

async function handleFormDetail(c: FormsRouteContext, resolveApp: () => App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''
  if (!/^[a-z][a-z0-9-]*$/.test(formName) || formName.length > 64) {
    return c.json({ success: false, message: 'Invalid form name', code: 'BAD_REQUEST' }, 400)
  }

  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const item = await buildFormAdminItem(form)
  const parsed = formAdminDetailResponseSchema.safeParse(item)
  if (!parsed.success) {
    console.error('[admin] form detail response validation failed', parsed.error)
    return c.json(
      { success: false, message: 'Failed to build form detail', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_DETAIL_QUERIED,
    actor,
    resourceId: form.name,
    severity: 'info',
    result: 'success',
  })

  return c.json(parsed.data, 200)
}


function encodeSubmissionsCursor(submittedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ submittedAt, id }), 'utf8').toString('base64')
}

function decodeSubmissionsCursor(
  cursor: string
): { readonly submittedAt: string; readonly id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly submittedAt?: unknown
      readonly id?: unknown
    }
    if (typeof decoded.submittedAt !== 'string' || typeof decoded.id !== 'string') return null
    return { submittedAt: decoded.submittedAt, id: decoded.id }
  } catch {
    return null
  }
}

function coerceStatus(raw: unknown): FormSubmissionStatus {
  if (
    raw === 'received' ||
    raw === 'processing' ||
    raw === 'done' ||
    raw === 'failed' ||
    raw === 'spam'
  ) {
    return raw
  }
  return 'received'
}

function buildSubmissionAdminItem(
  row: Readonly<{
    id: string
    formName: string | null
    submittedAt: Date | string
    status: string | null
    deletedAt: Date | string | null
  }>,
  formName: string
): FormSubmissionAdminItem {
  const submittedAt =
    row.submittedAt instanceof Date
      ? row.submittedAt.toISOString()
      : new Date(row.submittedAt).toISOString()
  const deletedAt =
    row.deletedAt === null || row.deletedAt === undefined
      ? null
      : row.deletedAt instanceof Date
        ? row.deletedAt.toISOString()
        : new Date(row.deletedAt).toISOString()
  return {
    id: row.id,
    formName: row.formName ?? formName,
    submittedAt,
    status: coerceStatus(row.status),
    _admin: {
      lastModifiedBy: null,
      deletedAt,
    },
  }
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

  const submissions = formSubmissionsTable()
  const conditions = [eq(submissions.formName, formName)]
  if (!query.include_deleted) {
    conditions.push(isNull(submissions.deletedAt))
  }
  if (query.status) {
    conditions.push(eq(submissions.status, query.status))
  }
  if (query.from) {
    conditions.push(gt(submissions.submittedAt, new Date(query.from)))
  }
  if (query.to) {
    conditions.push(lt(submissions.submittedAt, new Date(query.to)))
  }
  if (query.cursor) {
    const decoded = decodeSubmissionsCursor(query.cursor)
    if (decoded) {
      conditions.push(lt(submissions.submittedAt, new Date(decoded.submittedAt)))
    }
  }

  const rows = (await db
    .select({
      id: submissions.id,
      formName: submissions.formName,
      submittedAt: submissions.submittedAt,
      status: submissions.status,
      deletedAt: submissions.deletedAt,
    })
    .from(submissions)
    .where(and(...conditions))
    .orderBy(desc(submissions.submittedAt))
    .limit(query.limit + 1)) as ReadonlyArray<{
    id: string
    formName: string | null
    submittedAt: Date | string
    status: string | null
    deletedAt: Date | string | null
  }>

  const pageRows = rows.slice(0, query.limit)
  const items = pageRows.map((row) => buildSubmissionAdminItem(row, formName))
  const nextCursor =
    rows.length > query.limit && items.length > 0
      ? encodeSubmissionsCursor(items[items.length - 1]!.submittedAt, items[items.length - 1]!.id)
      : null

  const body = { items, nextCursor }
  const parsed = formsSubmissionsListResponseSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[admin] submissions list response validation failed', parsed.error)
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

  return c.json(parsed.data, 200)
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

  const submissions = formSubmissionsTable()
  const rows = (await db
    .select({
      id: submissions.id,
      formName: submissions.formName,
      submittedAt: submissions.submittedAt,
      status: submissions.status,
      deletedAt: submissions.deletedAt,
      data: submissions.data,
    })
    .from(submissions)
    .where(and(eq(submissions.id, submissionId), eq(submissions.formName, formName)))
    .limit(1)) as ReadonlyArray<{
    id: string
    formName: string | null
    submittedAt: Date | string
    status: string | null
    deletedAt: Date | string | null
    data: unknown
  }>

  const row = rows[0]
  if (!row) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const actor = await resolveActor(session.userId)
  const isAdmin = actor.role === 'admin'
  const captureAllowed = process.env['ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED'] === 'true'

  let bodyToInclude: Record<string, unknown> | undefined = undefined
  if (query.reveal) {
    if (!captureAllowed || !isAdmin) {
      return c.json(bodyCaptureDisabledErrorSchema.parse({ error: 'body-capture-disabled' }), 403)
    }
    bodyToInclude = (row.data ?? {}) as Record<string, unknown>
  }

  const item = buildSubmissionAdminItem(row, formName)
  const withBody: FormSubmissionAdminItem & { body?: Record<string, unknown> } = bodyToInclude
    ? { ...item, body: bodyToInclude }
    : item

  const parsed = formSubmissionDetailResponseSchema.safeParse(withBody)
  if (!parsed.success) {
    console.error('[admin] submission detail response validation failed', parsed.error)
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

  if (bodyToInclude !== undefined) {
    await emitAuditEvent({
      action: AUDIT_ACTIONS.FORM_SUBMISSION_BODY_REVEALED,
      actor,
      resourceId: submissionId,
      severity: 'critical',
      result: 'success',
    })
  }

  return c.json(parsed.data, 200)
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

  const submissions = formSubmissionsTable()
  const rows = (await db
    .select({
      id: submissions.id,
      formName: submissions.formName,
      submittedAt: submissions.submittedAt,
      status: submissions.status,
      deletedAt: submissions.deletedAt,
    })
    .from(submissions)
    .where(
      and(
        inArray(submissions.id, [...requestIds]),
        eq(submissions.formName, formName),
        isNull(submissions.deletedAt)
      )
    )) as ReadonlyArray<{
    id: string
    formName: string | null
    submittedAt: Date | string
    status: string | null
    deletedAt: Date | string | null
  }>

  const byId = new Map(rows.map((row) => [row.id, buildSubmissionAdminItem(row, formName)]))
  const items: FormSubmissionAdminItem[] = []
  for (const id of requestIds) {
    const item = byId.get(id)
    if (item) items.push(item)
  }

  const body = { items }
  const parsed = formsSubmissionsBulkResponseSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[admin] submissions bulk response validation failed', parsed.error)
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

  return c.json(parsed.data, 200)
}

export function chainAdminFormsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return chainAdminFormsRoutesInternal(honoApp, resolveApp)
}

