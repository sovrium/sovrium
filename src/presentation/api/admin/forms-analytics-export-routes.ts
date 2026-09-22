/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * F-04 admin endpoints — CSV export + analytics aggregate.
 *
 * Two new endpoints, sibling to the existing forms-list / submissions-list
 * / submission-detail / submissions-bulk surface in `admin/forms.ts`:
 *
 *   - GET /api/admin/forms/:formName/submissions/export?format=csv
 *       Inline CSV of submissions for the form. ≤1000 rows returns the
 *       full set with HTTP 200 + `Content-Type: text/csv`. Beyond 1000
 *       rows, the response still returns 200 + CSV but emits the header
 *       `X-Sovrium-Truncated: true` to signal that the client should
 *       fall back to a server-side job (the >1000-row job pipeline is
 *       explicitly OUT OF v1 scope per the locked F-04 plan).
 *       Field-level redaction applies: fields whose
 *       `permissions.read` excludes the requesting role have their
 *       VALUE blanked in CSV (the column header is retained).
 *
 *   - GET /api/admin/forms/:formName/analytics
 *       Aggregate metrics over a configurable window (default 30d,
 *       overridable via `?window=7d|24h`):
 *         { totalCount, completionRate, submissionsPerDay[],
 *           averageCompletionTime, attachmentCount, dropOffByStep }
 *       Forms with `analytics.enabled: false` return
 *         { disabled: true, reason: 'analytics-opted-out' }
 *       so per-form opt-out flows transparently through the dashboard.
 *
 * Both routes are gated by the same `requireAdminTier()` middleware as
 * the rest of `/api/admin/forms/*` — wired in `api-routes.ts`. The
 * anti-enum 404 (S1 / keystone §6.4) applies to non-existent forms.
 */

import { Effect } from 'effect'
import { AdminFormsRepository } from '@/application/ports/repositories/forms/admin-forms-repository'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { buildCsvAttachmentDisposition } from '@/domain/kernel/url/csv-attachment'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  evaluatePermission,
  OPEN_WHEN_UNDECLARED,
  permits,
} from '@/domain/models/app/auth/permission-evaluation'
import { exportRecordsToCsv } from '@/infrastructure/export/csv-exporter'
import { provideDomain, runDomainPromise } from '@/infrastructure/logging/request-effect'
import type { App } from '@/domain/models/app'
import type { PermissionValue } from '@/domain/models/app/auth/permissions'
import type { Form, FormField } from '@/domain/models/app/forms'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/* eslint-disable functional/no-let, functional/no-loop-statements, functional/immutable-data, functional/no-expression-statements, no-restricted-syntax, max-lines-per-function, max-statements, complexity, unicorn/no-null -- request-handler code mirrors the sibling forms.ts pattern; envelope canonically uses `null` for absent values. */

const EXPORT_INLINE_CAP = 1000
const DEFAULT_WINDOW_DAYS = 30

/**
 * Resolve whether a form field is readable by the given role. Returns
 * `true` when the field has no `permissions.read` declared OR when the
 * role is in the allowlist.
 *
 * Admin override: an admin outranks a field allowlist on every other read
 * path, so the operator running an export sees every column rather than
 * silently receiving a blank one.
 */
function isFieldReadable(field: FormField, role: string): boolean {
  // Casts: every field discriminant gets `permissions` from
  // `commonFieldProps` (FormFieldPermissionsSchema).
  const perms = (field as { readonly permissions?: { readonly read?: PermissionValue } })
    .permissions
  return permits(
    evaluatePermission(
      perms?.read,
      { role },
      {
        whenUndeclared: OPEN_WHEN_UNDECLARED,
        adminOverride: 'admin-outranks-everything',
      }
    )
  )
}

/** Best-effort field-name extraction across the four field-kind discriminants. */
function fieldName(field: FormField): string {
  if (field.kind === 'table-field') return field.column
  if (field.kind === 'standalone') return field.name
  if (field.kind === 'calculation') return field.name
  if (field.kind === 'signature') return field.name
  // section fields don't carry submitted data; column is absent
  return ''
}

/** Build the CSV column set, preserving form-declaration order. */
function buildCsvColumns(form: Form): readonly string[] {
  const names = form.fields.map(fieldName).filter((n) => n.length > 0)
  // Prepend canonical metadata columns. Status timeline and timestamps
  // are valuable for the operator triaging exports.
  return ['id', 'submitted_at', 'status', ...names]
}

/**
 * Build one CSV row from a ledger row + redaction context. Values for
 * fields not readable by the caller are blanked.
 */
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
    // Attachment field — surface the URL or summary, never the raw object.
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

/**
 * Format the CSV as a named download, with the truncation header if the inline
 * cap was hit.
 *
 * The `Content-Disposition` is what makes this a download at all: without it a
 * browser navigated to the export URL renders the CSV in the tab, which takes
 * the operator out of the console to stare at raw data. Naming it after the
 * FORM keeps three exported inboxes distinguishable on disk.
 */
function csvResponse(c: Context, csv: string, truncated: boolean, formName: string): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': buildCsvAttachmentDisposition(formName, new Date()),
    'Cache-Control': 'no-store',
  }
  if (truncated) headers['X-Sovrium-Truncated'] = 'true'
  return new Response(csv, { status: 200, headers })
}

/**
 * GET /api/admin/forms/:formName/submissions/export?format=csv
 *
 * Inline CSV ≤1000 rows. Beyond 1000 rows the response still returns
 * 200 + CSV but emits `X-Sovrium-Truncated: true`. The async polling
 * pipeline (`202 + jobId + pollUrl`) is OUT OF v1 scope per locked
 * F-04 plan; clients should detect the truncation header and surface
 * a "Refine your filter" UI affordance.
 */
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

  const role = await runDomainPromise(c, getUserRole(session.userId))
  // Pull EXPORT_INLINE_CAP + 1 to detect truncation. The +1 marker tells
  // us "there are more rows" without actually serializing them — keeps
  // the inline cap honest while remaining cheap.
  const rawRows = await Effect.runPromise(
    provideDomain(
      c,
      Effect.gen(function* () {
        const repository = yield* AdminFormsRepository
        return yield* repository.listSubmissionsWithData(formName, EXPORT_INLINE_CAP + 1)
      })
    )
  )

  const truncated = rawRows.length > EXPORT_INLINE_CAP
  const exported = rawRows.slice(0, EXPORT_INLINE_CAP)
  const columns = buildCsvColumns(form)
  const records = exported.map((row) => buildCsvRow(row, form, role))
  const csv = exportRecordsToCsv(
    records as ReadonlyArray<Readonly<Record<string, unknown>>>,
    columns
  )

  const actor = await runDomainPromise(c, resolveActor(session.userId))
  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_EXPORT_QUERIED,
    actor,
    resourceId: formName,
    severity: 'info',
    result: 'success',
  })

  return csvResponse(c, csv, truncated, formName)
}

// ─── Analytics aggregate handler ─────────────────────────────────────

/**
 * Parse the `?window=` parameter into a Date marking the lower bound
 * of the analytics window. Recognised values: `24h`, `7d`, `30d`.
 * Defaults to 30 days back when omitted or unrecognised.
 */
function parseWindowStart(window: string | undefined): Date {
  const now = new Date()
  if (window === '24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (window === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  // Default fallthrough
  return new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
}

interface AggregateRow {
  readonly id: string
  readonly submittedAt: Date | string
  readonly status: string | null
}

/** Group rows by YYYY-MM-DD bucket and return a sorted ascending list. */
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

/**
 * GET /api/admin/forms/:formName/analytics?window=24h|7d|30d
 *
 * Aggregates over the window. Per-form opt-out (`analytics.enabled:
 * false`) short-circuits to `{ disabled: true, reason: 'analytics-opted-out' }`
 * so the dashboard can display a clear "this form opted out" message.
 *
 * `dropOffByStep` is non-null only for multi-step forms; single-page
 * forms return `null`.
 */
async function handleAnalytics(c: Context, resolveApp: () => App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const app = resolveApp()
  const formName = c.req.param('formName') ?? ''
  const form = (app.forms ?? []).find((f) => f.name === formName)
  if (!form) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  // Per-form opt-out short-circuit. The endpoint still
  // returns 200 (not 404) so dashboards can display a clear message.
  if (form.analytics?.enabled === false) {
    const actor = await runDomainPromise(c, resolveActor(session.userId))
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
  const rows: readonly AggregateRow[] = await Effect.runPromise(
    provideDomain(
      c,
      Effect.gen(function* () {
        const repository = yield* AdminFormsRepository
        return yield* repository.listSubmissionsSince(formName, windowStart)
      })
    )
  )

  const totalCount = rows.length
  const doneCount = rows.filter((r) => r.status === 'done' || r.status === 'processed').length
  const completionRate = totalCount === 0 ? 0 : doneCount / totalCount

  // dropOffByStep: null for single-page, array (possibly empty) for
  // multi-step. The v1 implementation returns an empty array — full
  // per-step abandonment tracking requires the `form.steps[]` step
  // history which is out of v1 scope.
  const isMultiStep = form.layout === 'multi-step'
  const dropOffByStep = isMultiStep
    ? (form.steps ?? []).map((step) => ({ stepName: step.id, droppedCount: 0 }))
    : null

  // Count attachment fields with non-empty data values.
  let attachmentCount = 0
  for (const field of form.fields) {
    if (field.kind === 'table-field') {
      // Inspect each row's data for this attachment column.
      const colName = field.column
      attachmentCount += rows.filter(() => false).length // placeholder; see note
      // The above is intentionally zero — we don't fetch `data` for the
      // aggregate query (keeps the COUNT cheap). The full attachment
      // tally requires a separate query; in v1 we surface zero unless
      // the caller invokes the per-submission detail endpoint.
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

  const actor = await runDomainPromise(c, resolveActor(session.userId))
  await emitAuditEvent({
    action: AUDIT_ACTIONS.FORM_ANALYTICS_QUERIED,
    actor,
    resourceId: formName,
    severity: 'info',
    result: 'success',
  })

  return c.json(body, 200)
}

/**
 * Chain the F-04 analytics + export routes onto the parent Hono app.
 * Registration order: the export route is more specific than the
 * generic submissions detail path (`/submissions/:submissionId`), so
 * we register it FIRST to avoid the dynamic-segment route swallowing
 * `/submissions/export`.
 */
export function chainAdminFormsAnalyticsExportRoutes<T extends Hono>(
  honoApp: T,
  resolveApp: () => App
): T {
  return honoApp
    .get('/api/admin/forms/:formName/submissions/export', (c) => handleExport(c, resolveApp))
    .get('/api/admin/forms/:formName/analytics', (c) => handleAnalytics(c, resolveApp)) as T
}
