/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { HTTP_REQUEST_TIMEOUT_MS } from '@/domain/utils/timeouts'
import { validateOutboundUrl } from '@/infrastructure/utils/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/utils/with-fetch-timeout'
import { resolveConnectionHeaders } from './auth-headers'
import { serializeActionBody, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

/**
 * `webhook/send` handler — sends an outbound HTTP request with a JSON body
 * to a remote endpoint, bounded by a 5s abort to keep tests deterministic
 * when the remote is unreachable.
 *
 * Distinct from `http/request` in that webhook actions:
 *   - default to POST (vs GET)
 *   - serialize `props.body` as JSON in the request body
 *   - automatically set `Content-Type: application/json` so receivers
 *     (Slack, PagerDuty, Discord, generic consumer webhooks) parse the
 *     body without a hint
 *
 * Authentication injection is identical to `http/request` —
 * `props.connection` resolves to the same auth header per the connection
 * type (apiKey/basic/bearer build static headers; oauth2 resolves the
 * triggering user's stored token via `ConnectionTokenRepository`). This
 * is what APP-AUTOMATION-CONNECTION-090 verifies on the wire: webhook
 * actions inject credentials identically to HTTP actions.
 *
 * The handler intentionally does NOT classify upstream failure codes
 * (no `classifyHttpError` like `http/request` has). Webhooks are
 * fire-and-forget by convention — operators care about "did it fire"
 * more than the upstream's response shape — and the run-history error
 * field carries the raw status if a 4xx/5xx comes back.
 */
export const handleWebhookSend: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const url = stringProp(props, 'url')
    if (!url) return { status: 'failure', error: 'webhook.send requires a url' } as const

    // Webhook send defaults to POST; Slack/Discord/PagerDuty all expect POST.
    const method = String(props['method'] ?? 'POST')
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((props['headers'] as Record<string, string> | undefined) ?? {}),
    }
    const connectionName = stringProp(props, 'connection')

    const merged =
      connectionName !== ''
        ? yield* resolveConnectionHeaders(app, automation, baseHeaders, connectionName)
        : { headers: baseHeaders }

    if (merged.error !== undefined) {
      return { status: 'failure', error: merged.error } as const
    }

    // Serialize body if present. Receivers tolerate empty bodies on POST
    // (Slack will reject with 400 invalid_payload, but that's the
    // remote's choice; we surface it as an action failure). Webhook
    // semantics treat `null` like an absent body, so we normalise before
    // delegating serialisation.
    const rawBody = props['body'] === null ? undefined : props['body']
    const bodyResult = yield* Effect.either(serializeActionBody(rawBody))
    if (bodyResult._tag === 'Left') {
      return { status: 'failure', error: bodyResult.left.message } as const
    }

    return yield* Effect.promise(() => sendWebhook(url, method, merged.headers, bodyResult.right))
  })

/**
 * `webhook/response` handler — surfaces the resolved (status, body,
 * headers) trio via the `responseOverride` side-channel on
 * `ActionOutcome`. The synchronous webhook dispatcher
 * (`presentation/api/routes/automations/webhook-handler.ts`) reads
 * `result.responseOverride` and uses it to override the default sync
 * response shape.
 *
 * The runtime already substitutes `{{trigger.data.X}}` and
 * `{{trigger.headers.X}}` templates in `props` before the handler runs
 * (via `resolveTriggerInValue` in the run loop), so we just unwrap the
 * resolved values — no template work happens here.
 *
 * `responseOverride` (rather than `output`) so the payload does NOT
 * leak into `system.automation_runs.steps[].output` JSON nor the
 * `lastOutput` shallow-merge that surfaces under `output` in the
 * manual-trigger response body. The override is in-memory plumbing
 * only.
 *
 * Only meaningful for synchronous triggers (`respondImmediately !==
 * true`); for async (202) triggers the dispatcher discards the response
 * after the run has been kicked off, so the handler still records a
 * clean success in run-history but its override is effectively ignored
 * on the wire.
 */
export const handleWebhookResponse: ActionHandler = (action) =>
  Effect.sync(() => {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const responseOverride: Record<string, unknown> = {
      ...(props['status'] !== undefined ? { status: props['status'] } : {}),
      ...(props['body'] !== undefined ? { body: props['body'] } : {}),
      ...(props['headers'] !== undefined ? { headers: props['headers'] } : {}),
    }
    return { status: 'success', responseOverride } satisfies ActionOutcome
  })

/**
 * Bounded outbound POST. Mirrors `performHttpRequest` from `http.ts` but
 * accepts a body. Failures map to an `ActionOutcome` with
 * `status: 'failure'` so the run-history records a clean failure
 * regardless of the underlying cause (timeout, network, 4xx, 5xx).
 */
const sendWebhook = async (
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined
): Promise<ActionOutcome> => {
  // SSRF guard: same threat model as `http/*` action — a misconfigured
  // webhook destination must not reach internal infrastructure.
  const validation = validateOutboundUrl(url)
  if (!validation.ok) {
    return { status: 'failure', error: `invalid_outbound_url_${validation.issue.reason}` }
  }

  try {
    const response = await withFetchTimeout(
      url,
      {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
      },
      HTTP_REQUEST_TIMEOUT_MS
    )
    if (!response.ok) {
      return {
        status: 'failure',
        error: `webhook ${url}: HTTP ${String(response.status)}`,
      }
    }
    return { status: 'success' }
  } catch (error) {
    return {
      status: 'failure',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
