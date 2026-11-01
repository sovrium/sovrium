/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHmac } from 'node:crypto'
import { Effect, Schema, Struct } from 'effect'
import { OutboundHttp } from '@/application/ports/services/outbound-http'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { HTTP_REQUEST_TIMEOUT_MS } from '@/domain/kernel/time/timeouts'
import {
  WebhookResponseActionSchema,
  WebhookSendActionSchema,
} from '@/domain/models/app/automations/actions/webhook'
import {
  connectionHeaderRefusal,
  resolveConnectionHeaders,
  type InjectedHeaders,
} from './auth-headers'
import { credentialBindingRefusal } from './credential-binding'
import { decodedHandler } from './decoded-handler'
import { authoredActionProps, resolveOwnProp } from './run-context-resolution'
import { actionAttributes, serializeActionBody } from './shared'
import type { ActionOutcome, ActionRunContext } from './shared'
import type { ProcessEnvShape } from '@/application/ports/services/process-env'
import type { App } from '@/domain/models/app'

/**
 * The settings a `webhook/*` handler is dispatched with: each operator's
 * declared props, refused when outside them on every road the action comes by
 * (see `decoded-handler.ts`), except where a template fills a value of another
 * type in. A header value a whole `{{path}}` fills is sent as its text; the
 * body a template fills is sent as JSON whatever its shape, and an empty one
 * (`null`) as no body, as they always were.
 */
const filledHeadersAndBody = {
  headers: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  body: Schema.optional(Schema.Unknown),
}

export const WebhookSendSettings = Schema.Struct({
  type: WebhookSendActionSchema.fields.type,
  operator: WebhookSendActionSchema.fields.operator,
  props: WebhookSendActionSchema.fields.props.mapFields(Struct.assign(filledHeadersAndBody)),
})

export const WebhookResponseSettings = Schema.Struct({
  type: WebhookResponseActionSchema.fields.type,
  operator: WebhookResponseActionSchema.fields.operator,
  props: WebhookResponseActionSchema.fields.props.mapFields(Struct.assign(filledHeadersAndBody)),
})

/** Header values as the text they are sent as. */
const headerText = (
  headers: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(headers ?? {}).map(([name, value]) => [name, String(value)]))

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
 * is what an automation connection spec verifies on the wire: webhook
 * actions inject credentials identically to HTTP actions.
 *
 * The handler intentionally does NOT classify upstream failure codes
 * (no `classifyHttpError` like `http/request` has). Webhooks are
 * fire-and-forget by convention — operators care about "did it fire"
 * more than the upstream's response shape — and the run-history error
 * field carries the raw status if a 4xx/5xx comes back.
 */
/**
 * A key read from the address (`apiKey.query`) is not sent by a webhook: the
 * delivery would carry no credential at all, so it fails here instead of
 * reaching the receiver unauthenticated. The `http` actions send such a
 * connection.
 */
const addressKeyRefusal = (
  merged: { readonly query?: Readonly<Record<string, string>> },
  connectionName: string
): ActionOutcome | undefined =>
  merged.query !== undefined && Object.keys(merged.query).length > 0
    ? {
        status: 'failure',
        error: `webhook/send cannot send connection '${connectionName}': its key is read from the address (apiKey.query); use an http action`,
      }
    : undefined

/**
 * Why the webhook cannot be sent with its connection's credential, or
 * `undefined`: the credential could not be built, is read from the address, or
 * belongs to another site than the one the webhook goes to.
 */
const webhookConnectionRefusal = (
  merged: InjectedHeaders,
  target: { readonly app: App; readonly url: string; readonly connectionName: string },
  env: ProcessEnvShape
) =>
  connectionHeaderRefusal(merged) ??
  addressKeyRefusal(merged, target.connectionName) ??
  (target.connectionName !== ''
    ? credentialBindingRefusal(target.app, target.connectionName, target.url, { ...merged, env })
    : undefined)

/** The headers that carry a credential: the connection's, and the signature when one is sent. */
const credentialHeadersOf = (merged: InjectedHeaders, secret: string): readonly string[] => [
  ...(merged.credentialHeaders ?? []),
  ...(secret !== '' ? ['X-Webhook-Signature'] : []),
]

export const handleWebhookSend = decodedHandler(WebhookSendSettings, (action, app, automation) =>
  Effect.gen(function* () {
    const { props } = action
    const { url } = props
    if (url === '') return { status: 'failure', error: 'webhook.send requires a url' } as const

    // Webhook send defaults to POST; Slack/Discord/PagerDuty all expect POST.
    const method = props.method ?? 'POST'
    const baseHeaders: Readonly<Record<string, string>> = {
      'Content-Type': 'application/json',
      ...headerText(props.headers),
    }
    const connectionName = props.connection ?? ''

    const merged =
      connectionName !== ''
        ? yield* resolveConnectionHeaders(app, automation, baseHeaders, connectionName)
        : { headers: baseHeaders }

    const refusal = webhookConnectionRefusal(
      merged,
      { app, url, connectionName },
      yield* ProcessEnv
    )
    if (refusal !== undefined) return refusal

    // Serialize body if present. Receivers tolerate empty bodies on POST
    // (Slack will reject with 400 invalid_payload, but that's the
    // remote's choice; we surface it as an action failure). Webhook
    // semantics treat `null` like an absent body, so we normalise before
    // delegating serialisation.
    const rawBody = props.body === null ? undefined : props.body
    const bodyResult = yield* Effect.result(serializeActionBody(rawBody))
    if (bodyResult._tag === 'Failure') {
      return { status: 'failure', error: bodyResult.failure.message } as const
    }

    // When a `secret` is configured, sign the serialized body with
    // HMAC-SHA256 and attach it as `X-Webhook-Signature: sha256=<hex>`.
    // Receivers (and the test fixture) recompute the digest over the raw
    // body to prove integrity + authenticity. An empty body still signs
    // (digest of the empty string) so the header is always present when a
    // secret is set.
    const secret = props.secret ?? ''
    const signedHeaders =
      secret !== ''
        ? { ...merged.headers, 'X-Webhook-Signature': signBody(bodyResult.success, secret) }
        : merged.headers

    return yield* sendWebhook(url, method, bodyResult.success, {
      headers: signedHeaders,
      credentialHeaders: credentialHeadersOf(merged, secret),
    })
  }).pipe(
    Effect.withSpan('automations.handle-webhook-send', { attributes: actionAttributes(action) })
  )
)

/**
 * Compute the `sha256=<hex>` HMAC signature header value for a request
 * body. Signs the empty string when the body is absent so the header is
 * present whenever a secret is configured (mirrors GitHub/Stripe webhook
 * conventions: `X-Hub-Signature-256` is always emitted on signed deliveries).
 */
const signBody = (body: string | undefined, secret: string): string =>
  `sha256=${createHmac('sha256', secret)
    .update(body ?? '')
    .digest('hex')}`

/**
 * The response body with each single-template value at its own type. `$env.X`
 * references are resolved in the authored text BEFORE the templates, so a
 * value a template brings in (a record's text) is never read for `$env.`.
 * Without a run context there is no raw action to read, and the substituted
 * body is used as is.
 */
const typedResponseBody = (
  substituted: unknown,
  runContext: ActionRunContext | undefined
): unknown => {
  if (runContext === undefined) return substituted
  const raw = authoredActionProps(runContext)['body']
  if (raw === undefined) return substituted
  return resolveOwnProp(runContext, raw)
}

/**
 * `webhook/response` handler — surfaces the resolved (status, body,
 * headers) trio via the `responseOverride` side-channel on
 * `ActionOutcome`. The synchronous webhook dispatcher
 * (`presentation/api/routes/automations/webhook-handler.ts`) reads
 * `result.responseOverride` and uses it to override the default sync
 * response shape.
 *
 * `status` and `headers` are taken from the props the run loop already
 * substituted. The `body` is resolved here from the RAW action through
 * `resolveRunContextValue`, like `flow/stop`'s `output`: the run loop's pass
 * renders every template as text, so a value that is exactly one `{{path}}`
 * would reach the caller as `"[object Object]"` or `"1200"`. Resolved here it
 * keeps its type (object, array, number, boolean, `null`); a path naming
 * nothing resolves to `undefined` and its key is left out of the JSON; a value
 * mixing text with templates stays a string.
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
export const handleWebhookResponse = decodedHandler(
  WebhookResponseSettings,
  (action, _app, _automation, runContext) =>
    Effect.sync(() => {
      const { props } = action
      const body = typedResponseBody(props.body, runContext)
      const responseOverride: Readonly<Record<string, unknown>> = {
        ...(props.status !== undefined ? { status: props.status } : {}),
        ...(body !== undefined ? { body } : {}),
        ...(props.headers !== undefined ? { headers: props.headers } : {}),
      }
      return { status: 'success', responseOverride } satisfies ActionOutcome
    }).pipe(Effect.withSpan('automations.handle-webhook-response'))
)

/**
 * Bounded outbound POST. Mirrors `performHttpRequest` from `http.ts` but
 * accepts a body. Failures map to an `ActionOutcome` with
 * `status: 'failure'` so the run-history records a clean failure
 * regardless of the underlying cause (timeout, network, 4xx, 5xx).
 */
const sendWebhook = (
  url: string,
  method: string,
  body: string | undefined,
  request: {
    readonly headers: Readonly<Record<string, string>>
    /** Dropped on a redirect to another origin. */
    readonly credentialHeaders: readonly string[]
  }
): Effect.Effect<ActionOutcome, never, OutboundHttp> =>
  Effect.gen(function* () {
    const { headers, credentialHeaders } = request
    const { guardedFetch } = yield* OutboundHttp
    // SSRF guard on the URL and on every redirect hop: same threat model as the
    // `http/*` action. The answer's body is not read — only its status counts.
    return yield* guardedFetch(
      url,
      { method, headers, ...(body !== undefined ? { body } : {}) },
      { timeoutMs: HTTP_REQUEST_TIMEOUT_MS, maxBodyBytes: 0, credentialHeaders }
    ).pipe(
      Effect.map((sent): ActionOutcome => {
        if (!sent.ok) return { status: 'failure', error: sent.message }
        const { response } = sent
        if (!response.ok) {
          return {
            status: 'failure',
            error: `webhook ${url}: HTTP ${String(response.status)}`,
          }
        }
        return { status: 'success' }
      }),
      Effect.catchTag('OutboundTransportError', ({ cause }) =>
        Effect.succeed<ActionOutcome>({
          status: 'failure',
          error: cause instanceof Error ? cause.message : String(cause),
        })
      )
    )
  })
