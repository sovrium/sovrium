/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The form analytics admin read, as a registry entry:
 * `GET /api/admin/forms/:formName/analytics` and its MCP tool, derived from one
 * description.
 *
 * Aggregate metrics over a window — `24h`, `7d` or `30d` (the default; any
 * other value falls back to it rather than being refused):
 * `{ totalCount, completionRate, submissionsPerDay, averageCompletionTime,
 * attachmentCount, dropOffByStep }`. A form declaring `analytics.enabled:
 * false` answers `{ disabled: true, reason: 'analytics-opted-out' }` with the
 * same success, so a dashboard can say why it shows nothing.
 *
 * Three figures are honest zeros in this version, as the wire contract says:
 * `averageCompletionTime` (no per-submission timing is captured),
 * `attachmentCount` (the aggregate does not read submission data) and every
 * `dropOffByStep[].droppedCount` (no step history is kept). `dropOffByStep` is
 * `null` for a single-page form and one row per declared step otherwise.
 *
 * An undeclared form — unknown or malformed alike — is not found and writes no
 * audit event. A successful read, the opt-out included, writes
 * `form.analytics.queried` naming the form.
 */

import { DateTime, Effect } from 'effect'
import { AdminFormsRepository } from '@/application/ports/repositories/forms/admin-forms-repository'
import {
  answerWithSchema,
  decodeAdminReadQuery,
  defineAdminRead,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import { declaredForm, notFound } from '@/application/use-cases/admin/forms-read-decoding'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  formAnalyticsQuerySchema,
  formAnalyticsResponseSchema,
  formsDetailParamsSchema,
} from '@/domain/models/api/admin/forms'
import type { AdminFormSubmissionRow } from '@/application/ports/repositories/forms/admin-forms-repository'
import type { Form } from '@/domain/models/app/forms'

const DAY_MS = 24 * 60 * 60 * 1000

/** How far back each recognised window reaches; anything else is the 30-day default. */
const WINDOW_MS: Readonly<Record<string, number>> = { '24h': DAY_MS, '7d': 7 * DAY_MS }
const DEFAULT_WINDOW_MS = 30 * DAY_MS

/** A decoded request: the declared form and the window it asked for. */
interface FormAnalyticsRequest {
  readonly form: Form
  readonly window: string | undefined
}

/** A row's submission instant as a UTC `YYYY-MM-DD` day. */
const submissionDay = (row: AdminFormSubmissionRow): string =>
  (row.submittedAt instanceof Date ? row.submittedAt : new Date(String(row.submittedAt)))
    .toISOString()
    .slice(0, 10)

/** Submissions per UTC day, ascending; days with no submission are absent. */
const submissionsPerDay = (
  rows: ReadonlyArray<AdminFormSubmissionRow>
): ReadonlyArray<{ readonly day: string; readonly count: number }> => {
  const counts = rows.reduce<Readonly<Record<string, number>>>((acc, row) => {
    const day = submissionDay(row)
    return { ...acc, [day]: (acc[day] ?? 0) + 1 }
  }, {})
  return Object.entries(counts)
    .map(([day, count]) => ({ day, count }))
    .toSorted((a, b) => a.day.localeCompare(b.day))
}

/** The aggregate over the window's rows. */
const aggregate = (form: Form, rows: ReadonlyArray<AdminFormSubmissionRow>) => {
  const done = rows.filter((row) => row.status === 'done' || row.status === 'processed').length
  return {
    totalCount: rows.length,
    completionRate: rows.length === 0 ? 0 : done / rows.length,
    dropOffByStep:
      form.layout === 'multi-step'
        ? (form.steps ?? []).map((step) => ({ stepName: step.id, droppedCount: 0 }))
        : null,
    submissionsPerDay: submissionsPerDay(rows),
    averageCompletionTime: 0,
    attachmentCount: 0,
  }
}

const formAnalytics = defineAdminRead<FormAnalyticsRequest>({
  id: 'forms.analytics',
  method: 'get',
  path: '/api/admin/forms/:formName/analytics',
  pathParams: ['formName'],
  queryParams: ['window'],
  tool: {
    suffix: 'form_analytics',
    description:
      "One form's submission figures over a window — total, completion rate, per-day counts — or that it opted out of analytics, as GET /api/admin/forms/:formName/analytics answers them (admin-only, read-only).",
    inputSchema: {
      type: 'object',
      properties: {
        formName: { type: 'string', description: 'The form name.' },
        window: {
          type: 'string',
          enum: ['24h', '7d', '30d'],
          description: 'The aggregation window (default 30d).',
        },
      },
      required: ['formName'],
    },
  },
  openapi: {
    summary: "Read one form's analytics",
    description:
      'Aggregate submission metrics over a window (`24h`, `7d` or `30d`, the default; any ' +
      'other value falls back to it). A form declaring `analytics.enabled: false` answers ' +
      '`{ disabled: true, reason: "analytics-opted-out" }`. An undeclared form is answered ' +
      '404 and writes no audit event. Admin only.',
    operationIdBase: 'getAdminFormAnalytics',
    paramsSchema: formsDetailParamsSchema,
    querySchema: formAnalyticsQuerySchema,
    responseSchema: formAnalyticsResponseSchema,
    responseDescription: 'The form analytics, or its opt-out',
  },
  subject: 'form analytics',
  // The form first, then the query — the route's own order.
  decode: (raw, app) => {
    const form = declaredForm(app, raw['formName'])
    if (form === undefined) return notFound
    const query = decodeAdminReadQuery(formAnalyticsQuerySchema, { window: raw['window'] })
    return query._tag === 'Ok' ? { _tag: 'Ok', input: { form, window: query.input.window } } : query
  },
  read: (_app, { form, window }) =>
    Effect.gen(function* () {
      if (form.analytics?.enabled === false) {
        return answerWithSchema(formAnalyticsResponseSchema, {
          disabled: true,
          reason: 'analytics-opted-out',
        })
      }
      const nowMs = DateTime.toEpochMillis(yield* DateTime.now)
      const since = new Date(nowMs - (WINDOW_MS[window ?? ''] ?? DEFAULT_WINDOW_MS))
      const rows = yield* (yield* AdminFormsRepository).listSubmissionsSince(form.name, since)
      return answerWithSchema(formAnalyticsResponseSchema, aggregate(form, rows))
    }),
  audit: {
    action: AUDIT_ACTIONS.FORM_ANALYTICS_QUERIED,
    resourceId: (_app, { form }) => form.name,
  },
})

/** The form analytics read. */
export const FORMS_ANALYTICS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [formAnalytics]
