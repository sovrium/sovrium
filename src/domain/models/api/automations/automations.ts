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

export const runStatusSchema = Schema.Literals([
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'cancelled',
  'retrying',
  'timed-out',
  'exhausted',
  'completed-with-errors',
]).annotate({ description: 'Automation run status' })

export type RunStatus = typeof runStatusSchema.Type

// ─── Step Result ─────────────────────────────────────────────────────────────

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
  startedAt: looseIsoDateTime({ description: 'Run start timestamp' }),
  completedAt: Schema.NullOr(looseIsoDateTime({ description: 'Run completion timestamp' })),
  durationMs: Schema.NullOr(
    Schema.Int.annotate({ description: 'Total run duration in milliseconds' })
  ),
  attempt: Schema.Int.annotate({ description: 'Retry attempt number (1 = first attempt)' }),
  error: Schema.NullOr(
    Schema.String.annotate({ description: 'Top-level error message if run failed' })
  ),
})

export type Run = typeof runSchema.Type

// ─── Run Detail Schema ───────────────────────────────────────────────────────

export const runDetailSchema = Schema.Struct({
  ...runSchema.fields,
  steps: Schema.Array(stepResultSchema).annotate({ description: 'Step-by-step execution results' }),
})

export type RunDetail = typeof runDetailSchema.Type

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
