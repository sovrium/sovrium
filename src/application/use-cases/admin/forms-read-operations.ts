/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The form and submission admin reads, as registry entries: the forms catalog,
 * one form, one form's submissions, one submission, and the submissions CSV
 * export.
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are derived from it. Each writes its `form.*.queried`
 * audit event on success; a revealed submission body additionally writes the
 * critical `form.submission.body.revealed` event.
 *
 * Two gates are the routes' own and hold on every surface:
 *
 *   - **Anti-enumeration.** A form the live config does not declare — an
 *     unknown name and a malformed one alike — is not found, and a submission
 *     of another form is answered exactly as one that does not exist.
 *   - **Body reveal.** A submission's body is withheld unless the caller asks
 *     to reveal it, the instance allows body capture
 *     (`ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true`) AND the caller's account role
 *     is admin-equivalent. Otherwise the reveal is refused by name
 *     (`body-capture-disabled`) — the caller already sees the submission, so
 *     naming the gate enumerates nothing.
 *
 * The CSV export blanks each field the caller's role may not read and flags a
 * cut-short file. The analytics read is its sibling
 * (`forms-analytics-read-operations.ts`); the bulk read is a POST, not a read.
 */

import { DateTime, Effect, Option, Schema } from 'effect'
import { AdminFormsRepository } from '@/application/ports/repositories/forms/admin-forms-repository'
import { AdminReadHost } from '@/application/ports/services/admin-read-host'
import {
  adminReadPathParams,
  adminReadText,
  defineAdminRead,
} from '@/application/use-cases/admin/admin-read-operation'
import {
  readSubmission,
  type SubmissionRequest,
} from '@/application/use-cases/admin/form-submission-reveal'
import {
  csvColumns,
  csvRow,
  EXPORT_INLINE_CAP,
  formSubmissionsExportQuerySchema,
} from '@/application/use-cases/admin/form-submissions-csv'
import { FORMS_ANALYTICS_READ_OPERATIONS } from '@/application/use-cases/admin/forms-analytics-read-operations'
import {
  BuildFormDetail,
  BuildFormsList,
  BuildSubmissionsList,
  type SubmissionsListInput,
} from '@/application/use-cases/admin/forms-overview'
import {
  declaredForm,
  decodeFormsList,
  decodeSubmissionsList,
  invalidQuery,
  isFormNameShape,
  notFound,
  type FormsListRequest,
} from '@/application/use-cases/admin/forms-read-decoding'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { buildCsvAttachmentDisposition } from '@/domain/kernel/url/csv-attachment'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  formAdminDetailResponseSchema,
  formSubmissionDetailQuerySchema,
  formSubmissionDetailResponseSchema,
  formsDetailParamsSchema,
  formsListQuerySchema,
  formsListResponseSchema,
  formsSubmissionsListQuerySchema,
  formsSubmissionsListResponseSchema,
  formSubmissionSchema,
} from '@/domain/models/api/admin/forms'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import type {
  AdminReadOperation,
  AdminReadOutcome,
} from '@/application/use-cases/admin/admin-read-operation'
import type { Form } from '@/domain/models/app/forms'

// ─── Catalog ─────────────────────────────────────────────────────────────────

const formsList = defineAdminRead<FormsListRequest>({
  id: 'forms.list',
  method: 'get',
  path: '/api/admin/forms',
  pathParams: [],
  queryParams: ['cursor', 'limit', 'search', 'include_deleted'],
  tool: {
    suffix: 'forms_list',
    description:
      'List the declared forms in config order with their submission figures, as GET /api/admin/forms answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Case-insensitive search over name and title.' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Forms per page.' },
        cursor: { type: 'string', description: 'The nextCursor of the previous page.' },
      },
    },
  },
  openapi: {
    summary: 'List the declared forms',
    description:
      'The forms the config declares, each with its operator envelope and submission ' +
      'figures. Admin only.',
    operationIdBase: 'listAdminForms',
    querySchema: formsListQuerySchema,
    responseSchema: formsListResponseSchema,
    responseDescription: 'One page of forms',
  },
  subject: 'forms list',
  decode: (raw) => ({ _tag: 'Ok', input: decodeFormsList(raw) }),
  read: (app, input) => BuildFormsList(app, input),
  audit: { action: AUDIT_ACTIONS.FORM_LIST_QUERIED, resourceId: (app) => app.name },
})

const formRead = defineAdminRead<string>({
  id: 'forms.read',
  method: 'get',
  path: '/api/admin/forms/:formName',
  pathParams: ['formName'],
  queryParams: [],
  tool: {
    suffix: 'form_read',
    description:
      'Read one declared form with its operator envelope, as GET /api/admin/forms/:formName answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: { formName: { type: 'string', description: 'The form name.' } },
      required: ['formName'],
    },
  },
  openapi: {
    summary: 'Read one form',
    description:
      'One declared form with its operator envelope. An undeclared name and a malformed one ' +
      'are both answered 404 and write no audit event. Admin only.',
    operationIdBase: 'getAdminForm',
    paramsSchema: formsDetailParamsSchema,
    responseSchema: formAdminDetailResponseSchema,
    responseDescription: 'The form',
  },
  subject: 'form detail',
  decode: ({ formName }) =>
    isFormNameShape(formName) ? { _tag: 'Ok', input: formName } : notFound,
  read: (app, formName) => BuildFormDetail(app, formName),
  audit: { action: AUDIT_ACTIONS.FORM_DETAIL_QUERIED, resourceId: (_app, formName) => formName },
})

// ─── Submissions ─────────────────────────────────────────────────────────────

const submissionsList = defineAdminRead<SubmissionsListInput>({
  id: 'forms.submissions.list',
  method: 'get',
  path: '/api/admin/forms/:formName/submissions',
  pathParams: ['formName'],
  queryParams: ['cursor', 'limit', 'status', 'from', 'to', 'include_deleted', 'q'],
  tool: {
    suffix: 'form_submissions_list',
    description:
      "List one form's submissions newest first, without their bodies, as GET /api/admin/forms/:formName/submissions answers them (admin-only, read-only).",
    inputSchema: {
      type: 'object',
      properties: {
        formName: { type: 'string', description: 'The form name.' },
        status: { type: 'string', description: 'Only submissions in this status, e.g. spam.' },
        from: {
          type: 'string',
          format: 'date-time',
          description: 'Only submissions at or after this ISO 8601 instant.',
        },
        to: {
          type: 'string',
          format: 'date-time',
          description: 'Only submissions before this ISO 8601 instant.',
        },
        q: {
          type: 'string',
          description: 'Search over the submitter identity and the submission id.',
        },
        include_deleted: { type: 'boolean', description: 'Include deleted submissions.' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          description: 'Submissions per page.',
        },
        cursor: { type: 'string', description: 'The nextCursor of the previous page.' },
      },
      required: ['formName'],
    },
  },
  openapi: {
    summary: "List one form's submissions",
    description:
      'Cursor-paginated submissions of one form, newest first, never carrying a submitted ' +
      'body. An undeclared form is answered 404 and writes no audit event. Admin only.',
    operationIdBase: 'listAdminFormSubmissions',
    paramsSchema: formsDetailParamsSchema,
    querySchema: formsSubmissionsListQuerySchema,
    responseSchema: formsSubmissionsListResponseSchema,
    responseDescription: 'One page of submissions',
    baseSchemas: [formSubmissionSchema],
  },
  subject: 'submissions list',
  decode: decodeSubmissionsList,
  read: (_app, input) => BuildSubmissionsList(input),
  audit: {
    action: AUDIT_ACTIONS.FORM_SUBMISSION_LIST_QUERIED,
    resourceId: (_app, input) => input.formName,
  },
})

const submissionRead = defineAdminRead<SubmissionRequest>({
  id: 'forms.submissions.read',
  method: 'get',
  path: '/api/admin/forms/:formName/submissions/:submissionId',
  pathParams: ['formName', 'submissionId'],
  queryParams: ['reveal', 'audit'],
  tool: {
    suffix: 'form_submission_read',
    description:
      'Read one form submission, its body withheld unless revealed where the instance allows it, as GET /api/admin/forms/:formName/submissions/:submissionId answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        formName: { type: 'string', description: 'The form name.' },
        submissionId: { type: 'string', description: 'The submission id.' },
        reveal: {
          type: 'boolean',
          description:
            'Include the submitted body. Refused unless the instance allows body capture; a reveal is audited as critical.',
        },
      },
      required: ['formName', 'submissionId'],
    },
  },
  openapi: {
    summary: 'Read one form submission',
    description:
      'One submission of one form. `reveal=true` includes the submitted body when the ' +
      'instance sets `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` and the caller is an ' +
      'admin, and writes a critical `form.submission.body.revealed` event; otherwise it is ' +
      'refused 403 `body-capture-disabled`. An undeclared form, an unknown submission and a ' +
      'submission of another form are all answered 404. Admin only.',
    operationIdBase: 'getAdminFormSubmission',
    paramsSchema: adminReadPathParams({
      formName: 'The form name',
      submissionId: 'The submission id',
    }),
    querySchema: formSubmissionDetailQuerySchema,
    responseSchema: formSubmissionDetailResponseSchema,
    responseDescription: 'The submission',
    baseSchemas: [formSubmissionSchema],
  },
  subject: 'submission detail',
  // The query first, then the form — the route's own order.
  decode: (raw, app) =>
    Option.match(
      Schema.decodeOption(formSubmissionDetailQuerySchema)({
        reveal: raw['reveal'],
        audit: raw['audit'],
      }),
      {
        onNone: () => invalidQuery,
        onSome: (query) => {
          const form = declaredForm(app, raw['formName'])
          const { submissionId } = raw
          return form === undefined || typeof submissionId !== 'string'
            ? notFound
            : ({
                _tag: 'Ok',
                input: { formName: form.name, submissionId, reveal: query.reveal },
              } as const)
        },
      }
    ),
  read: (app, request, caller) => readSubmission(app, request, caller.actorUserId),
  audit: {
    action: AUDIT_ACTIONS.FORM_SUBMISSION_DETAIL_QUERIED,
    resourceId: (_app, request) => request.submissionId,
  },
})

// ─── CSV export ──────────────────────────────────────────────────────────────

const submissionsExport = defineAdminRead<Form>({
  id: 'forms.submissions.export',
  method: 'get',
  path: '/api/admin/forms/:formName/submissions/export',
  pathParams: ['formName'],
  queryParams: ['format'],
  tool: {
    suffix: 'form_submissions_export',
    description:
      "Export one form's submissions as CSV — the same text GET /api/admin/forms/:formName/submissions/export downloads, unreadable fields blanked (admin-only, read-only).",
    inputSchema: {
      type: 'object',
      properties: { formName: { type: 'string', description: 'The form name.' } },
      required: ['formName'],
    },
  },
  openapi: {
    summary: "Export one form's submissions",
    description:
      'The submissions of one form as a CSV download, one row per submission in ' +
      'form-declaration column order, a field the caller may not read blanked. Past ' +
      `${EXPORT_INLINE_CAP} rows the file is cut short and \`X-Sovrium-Truncated: true\` is ` +
      'set. Admin only.',
    operationIdBase: 'exportAdminFormSubmissions',
    paramsSchema: formsDetailParamsSchema,
    querySchema: formSubmissionsExportQuerySchema,
    responseSchema: Schema.String,
    responseDescription: 'The submissions as CSV',
    responseContentType: 'text/csv',
  },
  subject: 'submissions export',
  decode: (raw, app) => {
    const form = declaredForm(app, raw['formName'])
    if (form === undefined) return notFound
    const format = raw['format'] ?? 'csv'
    return format === 'csv'
      ? { _tag: 'Ok', input: form }
      : { ...invalidQuery, message: 'Only csv format is supported' }
  },
  read: (app, form, caller) =>
    Effect.gen(function* () {
      const role = yield* getUserRole(caller.actorUserId)
      const repository = yield* AdminFormsRepository
      const rows = yield* repository.listSubmissionsWithData(form.name, EXPORT_INLINE_CAP + 1)
      const permissionCaller = { role, adminEquivalent: isAdminEquivalent(role, app) }
      const host = yield* AdminReadHost
      const csv = host.encodeCsv(
        rows.slice(0, EXPORT_INLINE_CAP).map((row) => csvRow(row, form, permissionCaller)),
        csvColumns(form)
      )
      const takenAt = DateTime.toDateUtc(yield* DateTime.now)
      // A named download: without `Content-Disposition` a browser navigated to
      // the export renders it in the tab. A cut-short file says so.
      return {
        _tag: 'Ok',
        body: adminReadText('text/csv; charset=utf-8', csv, {
          'Content-Disposition': buildCsvAttachmentDisposition(form.name, takenAt),
          ...(rows.length > EXPORT_INLINE_CAP ? { 'X-Sovrium-Truncated': 'true' } : {}),
        }),
      } satisfies AdminReadOutcome
    }),
  audit: { action: AUDIT_ACTIONS.FORM_EXPORT_QUERIED, resourceId: (_app, form) => form.name },
})

/**
 * The form admin reads, in the order the registry lists them. Over HTTP the
 * export is mounted BEFORE the one-submission read, so `/submissions/export`
 * is not captured as a submission id.
 */
export const FORMS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  formsList,
  formRead,
  submissionsList,
  submissionsExport,
  submissionRead,
  ...FORMS_ANALYTICS_READ_OPERATIONS,
]
