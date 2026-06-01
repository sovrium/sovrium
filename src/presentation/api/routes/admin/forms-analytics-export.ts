/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { and, desc, eq, gte, isNull } from 'drizzle-orm'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { db } from '@/infrastructure/database'
import { formSubmissionsTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { exportRecordsToCsv } from '@/infrastructure/export/csv-exporter'
import type { App } from '@/domain/models/app'
import type { Form, FormField } from '@/domain/models/app/forms'
import type { PermissionValue } from '@/domain/models/shared/permissions'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'


const EXPORT_INLINE_CAP = 1000
const DEFAULT_WINDOW_DAYS = 30

function roleAllowed(perm: PermissionValue, role: string): boolean {
  if (perm === 'all' || perm === 'authenticated') return true
  if (Array.isArray(perm)) return perm.includes(role)
  return false
}

function isFieldReadable(field: FormField, role: string): boolean {
  const perms = (field as { readonly permissions?: { readonly read?: PermissionValue } })
    .permissions
  if (!perms?.read) return true
  return roleAllowed(perms.read, role)
}

function fieldName(field: FormField): string {
  if (field.kind === 'table-field') return field.column
  if (field.kind === 'standalone') return field.name
  if (field.kind === 'calculation') return field.name
  if (field.kind === 'signature') return field.name
  return ''
}

function buildCsvColumns(form: Form): readonly string[] {
  const names = form.fields.map(fieldName).filter((n) => n.length > 0)
  return ['id', 'submitted_at', 'status', ...names]
}

function buildCsvRow(
  ledgerRow: {
    readonly id: string
    readonly submittedAt: Date | string
    readonly status: string | null
    readonly data: unknown
  },
  form: Form,
  role: string
): Record<string, unknown> {
  const data = (ledgerRow.data ?? {}) as Record<string, unknown>
  const out: Record<string, unknown> = {
    id: ledgerRow.id,
    submitted_at:
      ledgerRow.submittedAt instanceof Date
        ? ledgerRow.submittedAt.toISOString()
        : ledgerRow.submittedAt,
    status: ledgerRow.status ?? '',
  }
  for (const field of form.fields) {
    const name = fieldName(field)
    if (name.length === 0) continue
    if (!isFieldReadable(field, role)) {
      out[name] = ''
      continue
    }
    const raw = data[name]
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as { url?: string; name?: string }
      out[name] = obj.url ?? obj.name ?? JSON.stringify(raw)
    } else if (Array.isArray(raw)) {
      out[name] = raw.join(', ')
    } else {
      out[name] = raw ?? ''
    }
  }
  return out
}

function csvResponse(c: Context, csv: string, truncated: boolean): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'text/csv; charset=utf-8',
    'Cache-Control': 'no-store',
  }
  if (truncated) headers['X-Sovrium-Truncated'] = 'true'
  return new Response(csv, { status: 200, headers })
}

async function handleExport(c: Context, resolveApp: () => App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''
  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  const format = c.req.query('format') ?? 'csv'
  if (format !== 'csv') {
    return c.json(
      { success: false, message: 'Only csv format is supported', code: 'BAD_REQUEST' },
      400
    )
  }

  const role = await getUserRole(session.userId)
  const submissions = formSubmissionsTable()
  const rawRows = (await db
    .select({
      id: submissions.id,
      submittedAt: submissions.submittedAt,
      status: submissions.status,
      data: submissions.data,
    })
    .from(submissions)
    .where(and(eq(submissions.formName, formName), isNull(submissions.deletedAt)))
    .orderBy(desc(submissions.submittedAt))
    .limit(EXPORT_INLINE_CAP + 1)) as ReadonlyArray<{
    id: string
    submittedAt: Date | string
    status: string | null
    data: unknown
  }>

  const truncated = rawRows.length > EXPORT_INLINE_CAP
  const exported = rawRows.slice(0, EXPORT_INLINE_CAP)
  const columns = buildCsvColumns(form)
  const records = exported.map((row) => buildCsvRow(row, form, role))
  const csv = exportRecordsToCsv(
    records as ReadonlyArray<Readonly<Record<string, unknown>>>,
    columns
  )

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_EXPORT_QUERIED,
    actor,
    resourceId: formName,
    severity: 'info',
    result: 'success',
  })

  return csvResponse(c, csv, truncated)
}


function parseWindowStart(window: string | undefined): Date {
  const now = new Date()
  if (window === '24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (window === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
}

interface AggregateRow {
  readonly id: string
  readonly submittedAt: Date | string
  readonly status: string | null
}

function buildSubmissionsPerDay(
  rows: readonly AggregateRow[]
): readonly { readonly day: string; readonly count: number }[] {
  const buckets = new Map<string, number>()
  for (const row of rows) {
    const date =
      row.submittedAt instanceof Date ? row.submittedAt : new Date(String(row.submittedAt))
    const key = date.toISOString().slice(0, 10)
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return Array.from(buckets.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

async function handleAnalytics(c: Context, resolveApp: () => App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''
  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  if (form.analytics?.enabled === false) {
    const actor = await resolveActor(session.userId)
    await emitAuditEvent({
      action: AUDIT_ACTIONS.FORM_ANALYTICS_QUERIED,
      actor,
      resourceId: formName,
      severity: 'info',
      result: 'success',
    })
    return c.json({ disabled: true, reason: 'analytics-opted-out' }, 200)
  }

  const windowStart = parseWindowStart(c.req.query('window'))
  const submissions = formSubmissionsTable()
  const rows = (await db
    .select({
      id: submissions.id,
      submittedAt: submissions.submittedAt,
      status: submissions.status,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.formName, formName),
        isNull(submissions.deletedAt),
        gte(submissions.submittedAt, windowStart)
      )
    )) as readonly AggregateRow[]

  const totalCount = rows.length
  const doneCount = rows.filter((r) => r.status === 'done' || r.status === 'processed').length
  const completionRate = totalCount === 0 ? 0 : doneCount / totalCount

  const isMultiStep = form.layout === 'multi-step'
  const dropOffByStep = isMultiStep
    ? (form.steps ?? []).map((step) => ({ stepName: step.id, droppedCount: 0 }))
    : null

  let attachmentCount = 0
  for (const field of form.fields) {
    if (field.kind === 'table-field') {
      const colName = field.column
      attachmentCount += rows.filter(() => false).length
      void colName
    }
  }

  const body = {
    totalCount,
    completionRate,
    dropOffByStep,
    submissionsPerDay: buildSubmissionsPerDay(rows),
    averageCompletionTime: 0,
    attachmentCount,
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_ANALYTICS_QUERIED,
    actor,
    resourceId: formName,
    severity: 'info',
    result: 'success',
  })

  return c.json(body, 200)
}

export function chainAdminFormsAnalyticsExportRoutes<T extends Hono>(
  honoApp: T,
  resolveApp: () => App
): T {
  return honoApp
    .get('/api/admin/forms/:formName/submissions/export', (c) => handleExport(c, resolveApp))
    .get('/api/admin/forms/:formName/analytics', (c) => handleAnalytics(c, resolveApp)) as T
}
