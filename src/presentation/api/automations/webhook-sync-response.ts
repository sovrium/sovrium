/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTriggerInValue } from '@/application/use-cases/automations/resolve-trigger-data'
import {
  maskValues,
  revealableWriteOnlyValues,
  writeOnlyValuesOfRun,
} from '@/application/use-cases/automations/run/write-only-values'
import type { Trigger } from './webhook-methods'
import type { WebhookAnswer } from './webhook-revalidation'
import type { TemplateRenderer } from '@/application/ports/services/template-engine'
import type { TriggerData } from '@/application/use-cases/automations/resolve-trigger-data'
import type { RunAutomationResult } from '@/application/use-cases/automations/run-automation'
import type { PublicRunStatus, WebhookDefaultResponse } from '@/domain/models/api/automations'
import type { App } from '@/domain/models/app'

/**
 * The synchronous webhook answer: a `webhook/response` action's override, the
 * trigger's own `response` block, or the default `{ id, status }` body.
 */

type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

interface BuildResponseInput {
  readonly app: App
  readonly automationName: string
  readonly trigger: WebhookTrigger
  readonly result: RunAutomationResult
  readonly triggerData: TriggerData
  readonly templates: TemplateRenderer
  /** Whether the request's only credential was an API key (no session cookie). */
  readonly apiKeyOnly: boolean
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

/**
 * Whether the trigger's `revealWriteOnly` reaches this caller: a webhook that
 * authenticated a machine — `bearer` or `apiKey`, or `session` with a
 * `requiredRole` reached with an API key and no session cookie. A person
 * signed in to the browser is answered the mask, whatever the trigger names.
 */
const answersAMachine = (trigger: WebhookTrigger, apiKeyOnly: boolean): boolean => {
  const type = trigger.auth?.type
  if (type === 'bearer' || type === 'apiKey') return true
  return type === 'session' && trigger.auth?.requiredRole !== undefined && apiKeyOnly
}

/**
 * Whether the trigger's `revealWriteOnly` is in force for this caller. Such a
 * run acts as the system even behind a `session` webhook ({@link webhookActsAsSystem}),
 * so the fields it names are read at all — a run acting as a person reads none.
 */
const revealsToMachine = (trigger: WebhookTrigger, apiKeyOnly: boolean): boolean =>
  trigger.revealWriteOnly !== undefined && answersAMachine(trigger, apiKeyOnly)

/**
 * Whether this caller's run acts as the system — the one place that decides
 * it. A `session` webhook's run otherwise acts as its caller; it acts as the
 * system for a machine (a key and no session cookie, behind a `requiredRole`)
 * when its answer reveals write-only fields to it, or when it declares
 * `auth.runAs: 'system'`. A caller signed in with a cookie always acts as
 * herself, with or without a key beside it.
 */
export const webhookActsAsSystem = (trigger: WebhookTrigger, apiKeyOnly: boolean): boolean =>
  (trigger.revealWriteOnly !== undefined || trigger.auth?.runAs === 'system') &&
  answersAMachine(trigger, apiKeyOnly)

/** The `revealWriteOnly` list in force for this caller, or `undefined` when none is. */
const revealInForce = (input: BuildResponseInput): readonly string[] | undefined =>
  revealsToMachine(input.trigger, input.apiKeyOnly) ? input.trigger.revealWriteOnly : undefined

/**
 * The write-only values the run's answer must not carry: its own reads and its
 * callees', less what the trigger's `revealWriteOnly` hands its machine caller
 * — only values the run's own record steps read from a named field, never one
 * a callee returned or an unnamed field also holds. The run history is masked
 * elsewhere, whatever this answer carries.
 */
const answerSecrets = (input: BuildResponseInput): readonly string[] => {
  const called = input.result.calledWriteOnly ?? []
  const secrets = [
    ...writeOnlyValuesOfRun(input.app, input.automationName, input.result.actions),
    ...called,
  ]
  const reveal = revealInForce(input)
  if (reveal === undefined) return secrets
  const revealed = revealableWriteOnlyValues(input.app, input.automationName, {
    actions: input.result.actions,
    reveal,
    called,
  })
  return secrets.filter((secret) => !revealed.has(secret))
}

/**
 * `headers` for an answer that may carry a revealed value: `Cache-Control:
 * no-store`, replacing any the operator declared. The machine's credential
 * rides in a header a shared cache does not key on (`x-api-key`, an `apiKey`
 * header), so a stored GET answer would be served to the next caller of the
 * URL, whoever it is.
 */
const withNoStore = (
  headers: Readonly<Record<string, string>>
): Readonly<Record<string, string>> => ({
  ...Object.fromEntries(
    Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'cache-control')
  ),
  'Cache-Control': 'no-store',
})

/** A `webhook/response` action's answer, masked for this caller, never stored when it may reveal. */
const answerFromAction = (
  input: BuildResponseInput,
  actionResponse: Readonly<Record<string, unknown>>
) => {
  const answer = responseFromAction(maskValues(actionResponse, answerSecrets(input)))
  return revealInForce(input) === undefined
    ? { ...answer, revalidates: true }
    : { ...answer, headers: withNoStore(answer.headers), revalidates: false }
}

/**
 * The trigger's own `response` block, or the default body. The default names
 * the run and its status only; a configured `body` was shaped by the operator,
 * and its templates see `run.id` and `trigger.data` only, never a step's output.
 */
const answerFromTrigger = (input: BuildResponseInput): WebhookAnswer => {
  const { trigger, result, triggerData, templates } = input
  const cfg = trigger.response
  const status = cfg?.status ?? cfg?.statusCode ?? 200
  const context = { run: { id: result.runId }, trigger: { data: triggerData } }
  const body =
    cfg?.body !== undefined
      ? resolveTriggerInValue(cfg.body, context, templates)
      : defaultSyncBody(result)
  const headers =
    cfg?.headers !== undefined
      ? (resolveTriggerInValue(cfg.headers, context, templates) as Record<string, string>)
      : {}
  return { status, body, headers, revalidates: cfg?.body !== undefined }
}

/**
 * The run's answer, and whether a pull may revalidate it (`webhook-revalidation.ts`):
 * a declared body that reveals nothing, never the default `{ id, status }`.
 *
 * A `webhook/response` action — when present — takes precedence over both the
 * trigger-level `response` config and the default body; the run loop already
 * substituted the templates in its props. Whoever holds the webhook's URL reads
 * that answer, so a write-only value a step of the run read is masked in it, as
 * in every other answer of a run — but for the fields the trigger's
 * `revealWriteOnly` names, to a machine.
 */
export const buildSyncResponse = (input: BuildResponseInput): WebhookAnswer =>
  input.result.responseOverride === undefined
    ? answerFromTrigger(input)
    : answerFromAction(input, input.result.responseOverride)
