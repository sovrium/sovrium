/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTriggerInValue } from '@/application/use-cases/automations/resolve-trigger-data'
import type { Trigger } from './webhook-methods'
import type { TemplateRenderer } from '@/application/ports/services/template-engine'
import type { TriggerData } from '@/application/use-cases/automations/resolve-trigger-data'
import type { RunAutomationResult } from '@/application/use-cases/automations/run-automation'
import type { PublicRunStatus, WebhookDefaultResponse } from '@/domain/models/api/automations'

/**
 * The synchronous webhook answer: a `webhook/response` action's override, the
 * trigger's own `response` block, or the default `{ id, status }` body.
 */

type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

interface BuildResponseInput {
  readonly trigger: WebhookTrigger
  readonly result: RunAutomationResult
  readonly triggerData: TriggerData
  readonly templates: TemplateRenderer
}

/**
 * Map the engine's internal status to the public webhook-response status.
 * `'success'`/`'completed-with-errors'` are happy-path completions (the
 * latter records that some action failed but declared `continueOnError`);
 * `'failure'`/`'exhausted'`/`'timed-out'` collapse to `'failed'` so the
 * sync response stays binary-shaped. Callers wanting the richer status
 * label should read it off the runs API.
 */
const toWebhookResponseStatus = (status: RunAutomationResult['status']): PublicRunStatus => {
  if (status === 'success') return 'completed'
  if (status === 'completed-with-errors') return 'completed-with-errors'
  if (status === 'skipped') return 'skipped'
  if (status === 'cancelled') return 'cancelled'
  // A paused approval run is NOT a failure — surface the non-terminal
  // status verbatim so the response stays 200 and the caller sees the pause.
  if (status === 'waiting-approval') return 'waiting-approval'
  // A run parked on a long wait answers at once; it resumes from the database.
  if (status === 'waiting-delay') return 'waiting-delay'
  return 'failed'
}

/**
 * Default sync-webhook body: the run's id and status, nothing the run read.
 * The webhook's caller is whoever holds its URL, so no step output and no
 * step error (which can quote what the step read) is ever merged in; data
 * goes back only through a `webhook/response` action or `trigger.response`.
 * Its keys are {@link WebhookDefaultResponse}'s — the wire schema is the one
 * place they are listed. Unlike the manual trigger's answer, on purpose.
 */
const defaultSyncBody = (result: RunAutomationResult): WebhookDefaultResponse => ({
  id: result.runId,
  status: toWebhookResponseStatus(result.status),
})

/**
 * Translate a `webhook/response` action's `responseOverride` payload
 * (carried in `RunAutomationResult.responseOverride` — see A-10) into
 * the (status, body, headers) tuple the dispatcher returns. Templates
 * were already substituted in the action's props at dispatch time — this
 * helper just unwraps and types the values.
 */
const responseFromAction = (actionResponse: Readonly<Record<string, unknown>>) => {
  const status =
    typeof actionResponse['status'] === 'number' ? (actionResponse['status'] as number) : 200
  const body = actionResponse['body'] ?? {}
  const headers =
    actionResponse['headers'] !== undefined
      ? (actionResponse['headers'] as Record<string, string>)
      : {}
  return { status, body, headers }
}

export const buildSyncResponse = (input: BuildResponseInput) => {
  const { trigger, result, triggerData, templates } = input
  // A `webhook/response` action — when present — takes precedence over both
  // the trigger-level `response` config and the default sync body. The
  // handler has already substituted templates in its props (the run loop
  // does that before dispatch), so we just unwrap the override here.
  if (result.responseOverride !== undefined) return responseFromAction(result.responseOverride)
  const cfg = trigger.response
  const status = cfg?.status ?? cfg?.statusCode ?? 200
  const context = { run: { id: result.runId }, trigger: { data: triggerData } }
  // The default body names the run and its status only. When the operator
  // configured a `trigger.response.body`, we honour that instead — they
  // explicitly shaped the response (its templates see `run.id` and
  // `trigger.data` only, never a step's output).
  const body =
    cfg?.body !== undefined
      ? resolveTriggerInValue(cfg.body, context, templates)
      : defaultSyncBody(result)
  const headers =
    cfg?.headers !== undefined
      ? (resolveTriggerInValue(cfg.headers, context, templates) as Record<string, string>)
      : {}
  return { status, body, headers }
}
