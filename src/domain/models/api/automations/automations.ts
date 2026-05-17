/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

// ─── Run Status ──────────────────────────────────────────────────────────────

export const runStatusSchema = z
  .enum([
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
  ])
  .describe('Automation run status')

export type RunStatus = z.infer<typeof runStatusSchema>

// ─── Step Result ─────────────────────────────────────────────────────────────

export const stepResultSchema = z.object({
  name: z.string().describe('Action step name'),
  type: z.string().describe('Action type (code, http, record, etc.)'),
  status: z
    .enum(['pending', 'running', 'completed', 'failed', 'skipped', 'filtered'])
    .describe('Step execution status (filtered = intentionally stopped by filter action)'),
  startedAt: z.string().datetime().nullable().describe('Step start timestamp'),
  completedAt: z.string().datetime().nullable().describe('Step completion timestamp'),
  durationMs: z.number().int().nullable().describe('Step execution duration in milliseconds'),
  output: z.unknown().nullable().describe('Step output data (null if failed or pending)'),
  error: z.string().nullable().describe('Error message if step failed'),
})

export type StepResult = z.infer<typeof stepResultSchema>

// ─── Run Schema ──────────────────────────────────────────────────────────────

export const runSchema = z.object({
  id: z.string().uuid().describe('Unique run identifier'),
  automationName: z.string().describe('Name of the automation that was executed'),
  status: runStatusSchema,
  triggerType: z.string().describe('Trigger type that started this run'),
  triggerData: z.unknown().nullable().describe('Trigger payload data'),
  startedAt: z.string().datetime().describe('Run start timestamp'),
  completedAt: z.string().datetime().nullable().describe('Run completion timestamp'),
  durationMs: z.number().int().nullable().describe('Total run duration in milliseconds'),
  attempt: z.number().int().describe('Retry attempt number (1 = first attempt)'),
  error: z.string().nullable().describe('Top-level error message if run failed'),
})

export type Run = z.infer<typeof runSchema>

// ─── Run Detail Schema ───────────────────────────────────────────────────────

export const runDetailSchema = runSchema.extend({
  steps: z.array(stepResultSchema).describe('Step-by-step execution results'),
})

export type RunDetail = z.infer<typeof runDetailSchema>

// ─── List Runs Response ──────────────────────────────────────────────────────

/**
 * Forward-looking shape for `GET /api/automations/runs` — declares the
 * paginated response we WILL ship once the runs listing supports paging.
 *
 * Drift note (REC-C3-4 audit, Wave-2 2026-05-01): the live route handler
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
export const listRunsResponseSchema = z.object({
  runs: z.array(runSchema).describe('List of automation runs'),
  pagination: z
    .object({
      total: z.number().int().describe('Total count of matching runs'),
      page: z.number().int().describe('Current page number'),
      pageSize: z.number().int().describe('Items per page'),
      totalPages: z.number().int().describe('Total number of pages'),
    })
    .optional()
    .describe(
      'Pagination metadata. Currently optional (forward-looking): the live route omits this envelope until pagination wiring lands. Will become required once `?page`/`?pageSize` query params are honored.'
    ),
})

export type ListRunsResponse = z.infer<typeof listRunsResponseSchema>

// ─── List Runs Query Params ──────────────────────────────────────────────────

export const listRunsQuerySchema = z.object({
  automationName: z.string().optional().describe('Filter by automation name'),
  status: runStatusSchema.optional().describe('Filter by run status'),
  page: z.coerce.number().int().min(1).optional().describe('Page number (default: 1)'),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Items per page (default: 20)'),
})

export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>

// ─── Replay Run Request ──────────────────────────────────────────────────────

export const replayRunRequestSchema = z.object({
  /** Override trigger data for replay (optional — uses original if omitted) */
  triggerData: z.unknown().optional().describe('Override trigger data for replay'),

  /** Step name to re-run from (optional — skips already-succeeded steps before this point) */
  fromStep: z
    .string()
    .optional()
    .describe(
      'Step name to re-run from. Steps before this that succeeded are skipped. If omitted, re-runs from first failed step.'
    ),
})

export type ReplayRunRequest = z.infer<typeof replayRunRequestSchema>

// ─── Trigger Response ────────────────────────────────────────────────────────

/**
 * Public response body for `POST /api/automations/:name/webhook` AND
 * `POST /api/automations/:name/trigger` (manual trigger).
 *
 * Both routes share the same shape because they both run the same use case
 * (`runWebhookAutomation` / `runManualAutomation` returning `RunAutomationResult`)
 * and are mapped through `triggerResultBody` in `routes/automations/index.ts`.
 *
 * DEC-021 (Wave-3, 2026-05-04): the trigger response surfaces only the
 * **last action's output** as `output`, mirroring n8n's "When Last Node
 * Finishes" mode. Per-action visibility moved to the runs detail endpoint
 * (`GET /api/automations/runs/:id` → `runDetailSchema.steps[]`). This
 * supersedes the Wave-2 alignment (REC-C3-4) which exposed a per-action
 * map at `actions.<name>` — that contract leaked internal action names
 * into every webhook response and coupled API consumers to action naming.
 *
 * Currently exported for documentation / future OpenAPI wiring only — the
 * route handler does not validate against this schema. Callers may import
 * `TriggerResponse` for type-safe response handling.
 */
export const triggerResponseSchema = z.object({
  success: z.literal(true).describe('Run was dispatched (downstream failures still produce true)'),

  id: z.string().uuid().describe('ID of the created run (matches runs API)'),

  status: z
    .enum(['completed', 'failed'])
    .describe(
      'Terminal run status. `completed` = all actions succeeded; `failed` = at least one action failed (the run still records). Always synchronous: no `accepted` (async mode is not implemented).'
    ),

  output: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Output of the last action that produced non-empty output (n8n parity, DEC-021). Walks the executed-step list from the tail and returns the first `outcome.output` it finds — actions emitting nothing (filter, stop, state:set without return) are skipped over. Omitted when no action produced output. Overridden entirely by an explicit `webhook.response` action when the automation defines one. For per-action breakdown, call `GET /api/automations/runs/:id`.'
    ),

  error: z
    .string()
    .optional()
    .describe(
      'First action failure reason (already redacted by the secrets-redaction layer). Present only when `status === "failed"`. Surfaced inline so callers can distinguish auth failures from upstream HTTP errors without a follow-up GET to the runs endpoint.'
    ),
})

export type TriggerResponse = z.infer<typeof triggerResponseSchema>

// ─── Cancel Run Response ─────────────────────────────────────────────────────

export const cancelRunResponseSchema = z.object({
  id: z.string().uuid().describe('Run ID'),
  status: z.literal('cancelled').describe('New status'),
  cancelledAt: z.string().datetime().describe('Cancellation timestamp'),
})

export type CancelRunResponse = z.infer<typeof cancelRunResponseSchema>
