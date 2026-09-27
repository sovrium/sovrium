/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coercedNumber } from '@/domain/models/api/combinators/coerce'
import { describedUnknown } from '@/domain/models/api/combinators/described-ref'
import { looseIsoDateTime, uuid } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ─── Run Status ──────────────────────────────────────────────────────────────

/**
 * Every status a run row can carry.
 *
 * `queued` (waiting for a concurrency slot) and `waiting-approval` (paused on
 * an approval step) are written by the engine, so the list must admit them:
 * a run in either state would otherwise fail to encode and turn the whole
 * runs listing into a server error.
 *
 * `pending` and `retrying` are never written by the engine. They stay in the
 * list for API compatibility, so a client that switches on them keeps
 * compiling.
 */
export const runStatusSchema = Schema.Literals([
  'pending',
  'queued',
  'running',
  'waiting-approval',
  'completed',
  'failed',
  'skipped',
  'cancelled',
  'retrying',
  'timed-out',
  'exhausted',
  'completed-with-errors',
]).annotate({
  description:
    "Automation run status. 'queued' waits for a concurrency slot and 'waiting-approval' waits on an approval step. 'pending' and 'retrying' are never written by the engine and are kept for API compatibility.",
})

export type RunStatus = typeof runStatusSchema.Type

// ─── Step Result ─────────────────────────────────────────────────────────────

export const stepLogEntrySchema = Schema.Struct({
  level: Schema.Literals(['debug', 'info', 'warn', 'error']).annotate({
    description: 'Level the code action logged at (context.log.debug, info, warn or error)',
  }),
  message: Schema.String.annotate({
    description: 'The logged arguments joined with spaces, cut at 2 000 characters',
  }),
}).annotate({ description: 'One entry a code action wrote with context.log' })

export const stepResultSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Action step name' }),
  type: Schema.String.annotate({ description: 'Action type (code, http, record, etc.)' }),
  status: Schema.Literals([
    'pending',
    'running',
    'completed',
    'failed',
    'skipped',
    'filtered',
  ]).annotate({
    description: 'Step execution status (filtered = intentionally stopped by filter action)',
  }),
  startedAt: Schema.NullOr(looseIsoDateTime({ description: 'Step start timestamp' })),
  completedAt: Schema.NullOr(looseIsoDateTime({ description: 'Step completion timestamp' })),
  durationMs: Schema.NullOr(
    Schema.Int.annotate({ description: 'Step execution duration in milliseconds' })
  ),
  output: optionalField(describedUnknown('Step output data (null if failed or pending)')),
  error: Schema.NullOr(Schema.String.annotate({ description: 'Error message if step failed' })),
  logs: optionalField(
    Schema.Array(stepLogEntrySchema).annotate({
      description:
        "Entries a code action wrote with context.log, in call order, with the app's secrets masked. Absent for steps that log nothing.",
    })
  ),
})

export type StepResult = typeof stepResultSchema.Type

// ─── Run Schema ──────────────────────────────────────────────────────────────

export const runSchema = Schema.Struct({
  id: uuid({ description: 'Unique run identifier' }),
  automationName: Schema.String.annotate({
    description: 'Name of the automation that was executed',
  }),
  status: runStatusSchema,
  triggerType: Schema.String.annotate({ description: 'Trigger type that started this run' }),
  triggerData: optionalField(describedUnknown('Trigger payload data')),
  startedAt: Schema.NullOr(
    looseIsoDateTime({
      description:
        'When the run left the queue and began executing. Null while the run is still queued for a concurrency slot',
    })
  ),
  completedAt: Schema.NullOr(looseIsoDateTime({ description: 'Run completion timestamp' })),
  durationMs: Schema.NullOr(
    Schema.Int.annotate({
      description:
        'Active execution time in milliseconds, from startedAt to completion — time spent queued is excluded',
    })
  ),
  attempt: Schema.Int.annotate({ description: 'Retry attempt number (1 = first attempt)' }),
  error: Schema.NullOr(
    Schema.String.annotate({ description: 'Top-level error message if run failed' })
  ),
})

export type Run = typeof runSchema.Type

// ─── Run Detail Schema ───────────────────────────────────────────────────────

const runAttemptSchema = Schema.Struct({
  attemptNumber: Schema.Int.annotate({ description: 'Attempt number, 1 for the first try' }),
  timestamp: looseIsoDateTime({ description: 'When the attempt settled' }),
  error: optionalField(
    Schema.String.annotate({ description: 'Why the attempt failed, with secrets masked' })
  ),
}).annotate({ description: 'One attempt of a step retried under a retry policy' })

export const runDetailSchema = Schema.Struct({
  ...runSchema.fields,
  attempts: Schema.Array(runAttemptSchema).annotate({
    description:
      'Attempt history of the last step that ran under a retry policy, oldest first. Empty when no step was retried.',
  }),
  steps: Schema.Array(stepResultSchema).annotate({ description: 'Step-by-step execution results' }),
  approvalId: optionalField(
    Schema.NullOr(
      uuid({
        description:
          'Id of the approval request this run is waiting on, to post to its approve or reject endpoint. Null when the run has no approval step.',
      })
    )
  ),
})

export type RunDetail = typeof runDetailSchema.Type

// ─── Automation Approvals ────────────────────────────────────────────────────

/** Every status an automation approval request can carry. */
const approvalStatusSchema = Schema.Literals(['pending', 'approved', 'rejected']).annotate({
  description:
    'pending: waiting for an approver; approved: the run resumed; rejected: the run was terminated',
})

/**
 * One automation approval request, as `GET /api/automations/approvals` lists it.
 *
 * Carries the two ids the resolution endpoint
 * `POST /api/automations/runs/:runId/approvals/:approvalId/{approve,reject}`
 * needs, so a page can post to it from a row.
 */
export const automationApprovalSchema = Schema.Struct({
  approvalId: uuid({ description: 'Id of the approval request' }),
  runId: uuid({ description: 'Id of the run paused on this request' }),
  automationName: Schema.String.annotate({
    description: 'Name of the automation whose run is paused',
  }),
  status: approvalStatusSchema,
  message: Schema.NullOr(
    Schema.String.annotate({
      description: "The request's message as shown to approvers, templates rendered",
    })
  ),
  approvers: Schema.Union([
    Schema.Literal('all-admins'),
    Schema.Array(Schema.String.annotate({ description: 'An email address or a role name' })),
  ]).annotate({
    description:
      'Who may resolve the request: all-admins, or the email addresses and role names it names, as rendered when the request was created',
  }),
  requestedAt: looseIsoDateTime({ description: 'When the request was created' }),
  expiresAt: Schema.NullOr(
    looseIsoDateTime({ description: 'When the timeout fires. Null when the request has none' })
  ),
  resolvedAt: Schema.NullOr(
    looseIsoDateTime({ description: 'When an approver resolved it. Null while pending' })
  ),
})

export type AutomationApproval = typeof automationApprovalSchema.Type

/**
 * Query string of `GET /api/automations/approvals`.
 */
export const listAutomationApprovalsQuerySchema = Schema.Struct({
  status: optionalField(
    approvalStatusSchema.annotate({
      description: 'Which requests to list (default: pending)',
    })
  ),
})

export type ListAutomationApprovalsQuery = typeof listAutomationApprovalsQuerySchema.Type

/**
 * Response of `GET /api/automations/approvals`: only the requests the caller
 * may resolve, newest first.
 */
export const listAutomationApprovalsResponseSchema = Schema.Struct({
  approvals: Schema.Array(automationApprovalSchema).annotate({
    description: 'The approval requests the signed-in caller may resolve, newest first',
  }),
})

export type ListAutomationApprovalsResponse = typeof listAutomationApprovalsResponseSchema.Type

// ─── List Runs Response ──────────────────────────────────────────────────────

/**
 * Forward-looking shape for `GET /api/automations/runs` — declares the
 * paginated response we WILL ship once the runs listing supports paging.
 *
 * Drift note ([internal ref] audit, Wave-2 2026-05-01): the live route handler
 * (`routes/automations/index.ts:handleListRuns`) currently emits
 * `{ runs: [...] }` without a `pagination` envelope. Pagination wiring is
 * tracked separately and will land alongside the `?page` / `?pageSize`
 * query params already declared in `listRunsQuerySchema` below.
 *
 * Until that lands, callers should treat `pagination` as forward-compatible
 * documentation and not rely on it at runtime. Once pagination ships, the
 * route will start emitting the `pagination` envelope and this schema will
 * become consumable for OpenAPI validation.
 */
export const listRunsResponseSchema = Schema.Struct({
  runs: Schema.Array(runSchema).annotate({ description: 'List of automation runs' }),
  pagination: optionalField(
    Schema.Struct({
      total: Schema.Int.annotate({ description: 'Total count of matching runs' }),
      page: Schema.Int.annotate({ description: 'Current page number' }),
      pageSize: Schema.Int.annotate({ description: 'Items per page' }),
      totalPages: Schema.Int.annotate({ description: 'Total number of pages' }),
    }).annotate({
      description:
        'Pagination metadata. Currently optional (forward-looking): the live route omits this envelope until pagination wiring lands. Will become required once `?page`/`?pageSize` query params are honored.',
    })
  ),
})

export type ListRunsResponse = typeof listRunsResponseSchema.Type

// ─── List Runs Query Params ──────────────────────────────────────────────────

export const listRunsQuerySchema = Schema.Struct({
  automationName: optionalField(
    Schema.String.annotate({ description: 'Filter by automation name' })
  ),
  status: optionalField(runStatusSchema.annotate({ description: 'Filter by run status' })),
  page: optionalField(
    coercedNumber
      .annotate({ description: 'Page number (default: 1)' })
      .pipe(Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)))
  ),
  pageSize: optionalField(
    coercedNumber
      .annotate({ description: 'Items per page (default: 20)' })
      .pipe(
        Schema.check(
          Schema.isInt(),
          Schema.isGreaterThanOrEqualTo(1),
          Schema.isLessThanOrEqualTo(100)
        )
      )
  ),
})

export type ListRunsQuery = typeof listRunsQuerySchema.Type

// ─── Replay Run Request ──────────────────────────────────────────────────────

export const replayRunRequestSchema = Schema.Struct({
  /** Override trigger data for replay (optional — uses original if omitted) */
  triggerData: optionalField(describedUnknown('Override trigger data for replay')),
  /** Step name to re-run from (optional — skips already-succeeded steps before this point) */
  fromStep: optionalField(
    Schema.String.annotate({
      description:
        'Step name to re-run from. Steps before this that succeeded are skipped. If omitted, re-runs from first failed step.',
    })
  ),
})

export type ReplayRunRequest = typeof replayRunRequestSchema.Type

// ─── Trigger Response ────────────────────────────────────────────────────────

/**
 * Public response body for `POST /api/automations/:name/webhook` AND
 * `POST /api/automations/:name/trigger` (manual trigger).
 *
 * Both routes share the same shape because they both run the same use case
 * (`runWebhookAutomation` / `runManualAutomation` returning `RunAutomationResult`)
 * and are mapped through `triggerResultBody` in `routes/automations/index.ts`.
 *
 * [internal ref] (Wave-3, 2026-05-04): the trigger response surfaces only the
 * **last action's output** as `output`, mirroring n8n's "When Last Node
 * Finishes" mode. Per-action visibility moved to the runs detail endpoint
 * (`GET /api/automations/runs/:id` → `runDetailSchema.steps[]`). This
 * supersedes the Wave-2 alignment which exposed a per-action
 * map at `actions.<name>` — that contract leaked internal action names
 * into every webhook response and coupled API consumers to action naming.
 *
 * Currently exported for documentation / future OpenAPI wiring only — the
 * route handler does not validate against this schema. Callers may import
 * `TriggerResponse` for type-safe response handling.
 */
export const triggerResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({
    description: 'Run was dispatched (downstream failures still produce true)',
  }),
  id: uuid({ description: 'ID of the created run (matches runs API)' }),
  status: Schema.Literals(['completed', 'failed']).annotate({
    description:
      'Terminal run status. `completed` = all actions succeeded; `failed` = at least one action failed (the run still records). Always synchronous: no `accepted` (async mode is not implemented).',
  }),
  output: optionalField(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description:
        'Output of the last action that produced non-empty output (n8n parity). Walks the executed-step list from the tail and returns the first `outcome.output` it finds — actions emitting nothing (filter, stop, state:set without return) are skipped over. Omitted when no action produced output. Overridden entirely by an explicit `webhook.response` action when the automation defines one. For per-action breakdown, call `GET /api/automations/runs/:id`.',
    })
  ),
  error: optionalField(
    Schema.String.annotate({
      description:
        'First action failure reason (already redacted by the secrets-redaction layer). Present only when `status === "failed"`. Surfaced inline so callers can distinguish auth failures from upstream HTTP errors without a follow-up GET to the runs endpoint.',
    })
  ),
})

export type TriggerResponse = typeof triggerResponseSchema.Type

// ─── Cancel Run Response ─────────────────────────────────────────────────────

export const cancelRunResponseSchema = Schema.Struct({
  id: uuid({ description: 'Run ID' }),
  status: Schema.Literal('cancelled').annotate({ description: 'New status' }),
  cancelledAt: looseIsoDateTime({ description: 'Cancellation timestamp' }),
})

export type CancelRunResponse = typeof cancelRunResponseSchema.Type
