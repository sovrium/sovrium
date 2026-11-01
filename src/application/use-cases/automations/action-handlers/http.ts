/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { OutboundHttp, outboundText } from '@/application/ports/services/outbound-http'
import { HTTP_REQUEST_TIMEOUT_MS } from '@/domain/kernel/time/timeouts'
import { parseJsonResponseBody } from '@/domain/kernel/url/json-response-body'
import { appendQueryObject } from '@/domain/kernel/url/query-string'
import { connectionHeaderRefusal, resolveConnectionHeaders, withAuthQuery } from './auth-headers'
import { boundTarget } from './credential-binding'
import { decodedHandler } from './decoded-handler'
import { blockedRequestFailure, httpStatusFailure, requestFailure } from './http-failure'
import {
  HttpDeleteSettings,
  HttpGetSettings,
  HttpPatchSettings,
  HttpPostSettings,
  HttpPutSettings,
  HttpRequestSettings,
} from './http-settings'
import { actionAttributes, serializeActionBody } from './shared'
import type { DecodedAction, TypedActionHandler } from './decoded-handler'
import type { HttpBodyVerbAction, HttpCommonProps } from './http-settings'
import type { ActionOutcome, AutomationContext, BodySerializationError } from './shared'
import type { App } from '@/domain/models/app'

/**
 * Where a request goes and with which headers: the url with its `query`, and
 * the `headers` merged with the credential of the named `connection`. A
 * connection that cannot authenticate the request refuses it here.
 *
 * Each header is sent as its text: a template naming a number fills one in,
 * and the request has always carried it as its digits.
 */
const connectedTarget = (props: HttpCommonProps, app: App, automation: AutomationContext) =>
  Effect.gen(function* () {
    const url = appendQueryObject(props.url, props.query)
    const baseHeaders = Object.fromEntries(
      Object.entries(props.headers ?? {}).map(([name, value]) => [name, String(value)])
    )
    const merged =
      props.connection !== undefined && props.connection !== ''
        ? yield* resolveConnectionHeaders(app, automation, baseHeaders, props.connection)
        : { headers: baseHeaders }
    const refusal = connectionHeaderRefusal(merged)
    if (refusal !== undefined) return refusal
    return yield* boundTarget(app, props.connection, withAuthQuery(url, merged), merged)
  })

/**
 * The per-request timeout budget: `props.timeout` when declared, otherwise
 * {@link HTTP_REQUEST_TIMEOUT_MS}. The window (1000-120000 ms, a whole number)
 * is the schema's, checked where the action is dispatched, so a script's
 * `timeout: 200` is refused rather than quietly stretched to the minimum.
 *
 * 15 000 ms is the real fallback, not 30 000: a 30 000 ms default would
 * silently double the budget of every `http/*` action that declares nothing.
 */
const timeoutMsOf = (props: HttpCommonProps): number => props.timeout ?? HTTP_REQUEST_TIMEOUT_MS

/** An empty url, which a template naming nothing can fill in. */
const missingUrl = (operator: string): ActionOutcome => ({
  status: 'failure',
  error: `http.${operator} requires a url`,
})

/**
 * `http/request` handler — performs an outbound HTTP request, bounded by
 * `props.timeout` (default 15s) to keep a slow upstream from holding the run
 * open.
 *
 * When `props.connection` is set, looks up the named connection in
 * `app.connections[]` and injects credentials per the connection type
 * (apiKey/basic/bearer build static headers; oauth2 resolves the
 * current user's stored token via `ConnectionTokenRepository`).
 *
 * Returns the response as `output: { response: { status, headers, body } }`
 * so subsequent steps can read it via `context.steps.<name>.response.*`
 * String bodies pass through
 * verbatim; JSON-shaped bodies are stringified on the way out — unless
 * `props.contentType` declares another encoding.
 */
const runHttpRequest: TypedActionHandler<DecodedAction<typeof HttpRequestSettings>> = (
  action,
  app,
  automation
) =>
  Effect.gen(function* () {
    const { props } = action
    if (props.url === '') return missingUrl('request')
    const target = yield* connectedTarget(props, app, automation)
    if ('status' in target) return target
    // `http/request` declares `contentType` but has never defaulted a
    // Content-Type header of its own, so the shorthand is applied only when
    // the config asks for it — an absent `contentType` keeps the historical
    // serialize-and-send-no-header behaviour byte for byte.
    const bodyResult = yield* Effect.result(
      applyContentTypeShorthand(props.body, target.merged.headers, props.contentType)
    )
    if (bodyResult._tag === 'Failure') {
      return { status: 'failure', error: bodyResult.failure.message } as const
    }
    const { body, headers } = bodyResult.success
    return yield* performHttpWithResponseOutput({
      url: target.url,
      credentialHeaders: target.merged.credentialHeaders,
      method: props.method,
      headers,
      body,
      timeoutMs: timeoutMsOf(props),
    })
  }).pipe(
    Effect.withSpan('automations.handle-http-request', { attributes: actionAttributes(action) })
  )

export const handleHttpRequest = decodedHandler(HttpRequestSettings, runHttpRequest)

/**
 * The hard cap on a captured response body, in BYTES: the body is read up to
 * it and the rest is never downloaded, so a misbehaving upstream can neither
 * swell run-history memory nor hold the run open with an answer that never
 * ends. Hitting it is reported as `truncated` — past the cap the JSON parse of
 * the mutilated text fails, so no structured `body` is exposed, and nothing
 * else would distinguish that from an endpoint that genuinely returned nothing
 * (the motivating case being a wide Google Sheets `values.get`,
 */
const RESPONSE_BODY_CAP = 65_536

/**
 * Perform an outbound HTTP request and surface the response as `output` so
 * subsequent steps can read it via `context.steps.<name>.response.{status,
 * headers, body}`. Used by the convenience operators (`http/get`, `http/post`
 * today; put/patch/delete will land as their specs activate). The general
 * `http/request` handler above keeps its narrower contract — its specs
 * predate the response-output shape and don't assert against it.
 *
 * `body` is the already-serialised payload; callers (e.g. the POST handler)
 * own the encoding + Content-Type decision so this helper stays
 * method-agnostic.
 */
const performHttpWithResponseOutput = (input: {
  readonly url: string
  readonly method: string
  readonly headers: Record<string, string>
  readonly body?: string | undefined
  readonly timeoutMs: number
  readonly credentialHeaders?: readonly string[] | undefined
}): Effect.Effect<ActionOutcome, never, OutboundHttp> =>
  Effect.gen(function* () {
    const { url, method, headers, body: requestBody, timeoutMs, credentialHeaders } = input
    const { guardedFetch } = yield* OutboundHttp
    // SSRF guard on the URL AND on every redirect hop: a misconfigured or
    // hostile target can't steer the http/* action handler to internal services.
    return yield* guardedFetch(
      url,
      { method, headers, ...(requestBody !== undefined ? { body: requestBody } : {}) },
      { timeoutMs, maxBodyBytes: RESPONSE_BODY_CAP, credentialHeaders: credentialHeaders ?? [] }
    ).pipe(
      Effect.map((sent): ActionOutcome => {
        // A refusal of the outbound guard: nothing was sent (`error.code: 'blocked'`).
        if (!sent.ok) return blockedRequestFailure(sent.message)
        const { response } = sent
        const { truncated } = response
        const body = outboundText(response)
        const responseHeaders: Readonly<Record<string, string>> = Object.fromEntries(
          response.headers.entries()
        )
        // `truncated` is emitted only when true: an absent key keeps the envelope
        // of every under-cap response byte-identical to what it has always been.
        const responseEnvelope = {
          status: response.status,
          headers: responseHeaders,
          body,
          ...(truncated ? { truncated: true } : {}),
        }
        // Expose a STRUCTURED, JSON-parsed `body` ALONGSIDE the raw-text
        // `response.body` so a later step can read a field via
        // `{{steps.X.body.<key>}}`. The raw text stays at
        // `{{steps.X.response.body}}` for back-compat. Non-JSON responses leave
        // `parsedBody` undefined → only the raw envelope is exposed.
        const parsedBody = parseJsonResponseBody(body, responseHeaders)
        const parsedBodyField = parsedBody !== undefined ? { body: parsedBody } : {}
        if (!response.ok) {
          return httpStatusFailure(response.status, body, {
            response: responseEnvelope,
            ...parsedBodyField,
          })
        }
        return { status: 'success', output: { response: responseEnvelope, ...parsedBodyField } }
      }),
      // Sent and unanswered: a timeout, an unresolved host, a refused or
      // reset connection, an untrusted certificate (`error.code`).
      Effect.catchTag('OutboundTransportError', (failure) =>
        Effect.succeed(requestFailure(failure.cause))
      )
    )
  })

/**
 * `http/get` handler — convenience operator over `performHttpWithResponseOutput`
 * with method preset to `GET`. The schema (`HttpGetActionSchema`) refuses a
 * `body`, on every road the action comes by; this handler never reads one.
 */
export const handleHttpGet = decodedHandler(HttpGetSettings, (action, app, automation) =>
  Effect.gen(function* () {
    const { props } = action
    if (props.url === '') return missingUrl('get')
    const target = yield* connectedTarget(props, app, automation)
    if ('status' in target) return target
    return yield* performHttpWithResponseOutput({
      url: target.url,
      credentialHeaders: target.merged.credentialHeaders,
      method: 'GET',
      headers: target.merged.headers,
      timeoutMs: timeoutMsOf(props),
    })
  }).pipe(Effect.withSpan('automations.handle-http-get', { attributes: actionAttributes(action) }))
)

/**
 * Returns true when `headers` already declares a `Content-Type` value (any
 * casing). The lookup is case-insensitive because RFC 7230 §3.2 makes HTTP
 * field names case-insensitive — operators write `Content-Type` while the
 * `connection`-injected headers may use lowercase.
 */
const hasContentTypeHeader = (headers: Readonly<Record<string, string>>): boolean =>
  Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')

/**
 * The `props.contentType` shorthand → the media type it names. Mirrors the
 * schema's `Schema.Literal('json', 'form', 'text', 'xml')` on the four
 * body-bearing operators (`request`, `post`, `put`, `patch`); `get` and
 * `delete` do not declare the prop.
 */
const CONTENT_TYPE_BY_SHORTHAND = {
  json: 'application/json',
  form: 'application/x-www-form-urlencoded',
  text: 'text/plain',
  xml: 'application/xml',
} as const

type ContentTypeShorthand = keyof typeof CONTENT_TYPE_BY_SHORTHAND

/**
 * URL-encode a JSON-shaped body for `contentType: form`. Scalar values are
 * stringified as-is; a nested object/array is JSON-encoded into its field,
 * which is what every form-encoding receiver expects for a value that cannot
 * be flattened.
 */
const encodeFormBody = (body: Readonly<Record<string, unknown>>): string =>
  new URLSearchParams(
    // Entry-pair form (not a Record) so declaration order survives into the
    // encoded string — `Object.fromEntries` would hoist integer-like keys.
    Object.entries(body).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : (JSON.stringify(value) ?? ''),
    ])
  ).toString()

/**
 * Encode `rawBody` per the declared `contentType` shorthand and stamp the
 * matching `Content-Type` header.
 *
 * Two rules, both load-bearing:
 *
 * 1. **An explicit `Content-Type` header wins outright** — header AND
 *    encoding. Honouring the header while still form-encoding the payload
 *    would tell the receiver one thing and send it another, which is exactly
 *    the failure the shorthand exists to prevent. So an explicit header falls
 *    the whole way back to the default behaviour.
 * 2. **The shorthand governs the encoding, not only the header.** Announcing
 *    `application/x-www-form-urlencoded` over a JSON payload is a worse lie
 *    than ignoring the field, which is what the handler did before.
 *
 * A string body always passes through verbatim: the author already serialised
 * it and only wants the header named.
 */
const applyContentTypeShorthand = (
  rawBody: unknown,
  headers: Readonly<Record<string, string>>,
  shorthand: ContentTypeShorthand | undefined
): Effect.Effect<
  { readonly body: string | undefined; readonly headers: Record<string, string> },
  BodySerializationError
> => {
  if (rawBody === undefined) return Effect.succeed({ body: undefined, headers })
  if (shorthand === undefined || hasContentTypeHeader(headers)) {
    return serializeActionBody(rawBody).pipe(Effect.map((body) => ({ body, headers })))
  }
  const declared = { ...headers, 'Content-Type': CONTENT_TYPE_BY_SHORTHAND[shorthand] }
  if (typeof rawBody === 'string') return Effect.succeed({ body: rawBody, headers: declared })
  if (shorthand === 'form' && rawBody !== null && typeof rawBody === 'object') {
    return Effect.succeed({
      body: encodeFormBody(rawBody as Record<string, unknown>),
      headers: declared,
    })
  }
  return serializeActionBody(rawBody).pipe(Effect.map((body) => ({ body, headers: declared })))
}

/**
 * Serialise `props.body` for an HTTP POST and decide whether to default the
 * `Content-Type` header. An automation action HTTP post spec: when the
 * caller provides a JSON-shaped body and no explicit Content-Type, default
 * to `application/json` and JSON-stringify. POST-003: when an explicit
 * Content-Type is set, honour it and leave the body untouched (string
 * payloads pass through verbatim; JSON-shaped bodies still serialise so
 * the upstream gets a string the wire can carry).
 *
 * A declared `props.contentType` takes precedence over that default and is
 * delegated to {@link applyContentTypeShorthand}; an absent one leaves the
 * rules above exactly as they were.
 */
const buildPostRequestBody = (
  rawBody: unknown,
  headers: Readonly<Record<string, string>>,
  shorthand: ContentTypeShorthand | undefined
): Effect.Effect<
  { readonly body: string | undefined; readonly headers: Record<string, string> },
  BodySerializationError
> => {
  if (rawBody === undefined) return Effect.succeed({ body: undefined, headers })
  if (shorthand !== undefined && !hasContentTypeHeader(headers)) {
    return applyContentTypeShorthand(rawBody, headers, shorthand)
  }
  const explicitCt = hasContentTypeHeader(headers)
  if (typeof rawBody === 'string') {
    // Caller already serialised — assume they know the right Content-Type
    // and leave headers alone (they either set one explicitly or the
    // upstream tolerates the absence).
    return Effect.succeed({ body: rawBody, headers })
  }
  // JSON-shaped body. Default Content-Type when not explicitly set.
  return serializeActionBody(rawBody).pipe(
    Effect.map((body) => ({
      body,
      headers: explicitCt ? headers : { ...headers, 'Content-Type': 'application/json' },
    }))
  )
}

/**
 * Convenience-operator factory for the body-bearing verbs (`POST`, `PUT`,
 * `PATCH`). All three share the JSON-default-Content-Type behaviour
 * ([internal ref]-{POST,PUT,PATCH}-002) and honour an explicit
 * Content-Type override (…-003). The only difference is the HTTP method.
 */
const runHttpBodyVerb =
  (method: 'POST' | 'PUT' | 'PATCH'): TypedActionHandler<HttpBodyVerbAction> =>
  (action, app, automation) =>
    Effect.gen(function* () {
      const { props } = action
      if (props.url === '') return missingUrl(method.toLowerCase())
      const target = yield* connectedTarget(props, app, automation)
      if ('status' in target) return target
      const bodyResult = yield* Effect.result(
        buildPostRequestBody(props.body, target.merged.headers, props.contentType)
      )
      if (bodyResult._tag === 'Failure') {
        return { status: 'failure', error: bodyResult.failure.message } as const
      }
      const { body, headers } = bodyResult.success
      return yield* performHttpWithResponseOutput({
        url: target.url,
        credentialHeaders: target.merged.credentialHeaders,
        method,
        headers,
        body,
        timeoutMs: timeoutMsOf(props),
      })
    })

/**
 * `http/post` handler — convenience operator over `performHttpWithResponseOutput`
 * with method preset to `POST`. Defaults `Content-Type: application/json` for
 * JSON-shaped bodies, but honours an
 * explicit Content-Type override (POST-003).
 */
export const handleHttpPost = decodedHandler(HttpPostSettings, runHttpBodyVerb('POST'))

/** `http/put` handler — like {@link handleHttpPost} but method preset to `PUT` (full resource replacement). */
export const handleHttpPut = decodedHandler(HttpPutSettings, runHttpBodyVerb('PUT'))

/** `http/patch` handler — like {@link handleHttpPost} but method preset to `PATCH` (partial resource update). */
export const handleHttpPatch = decodedHandler(HttpPatchSettings, runHttpBodyVerb('PATCH'))

/**
 * `http/delete` handler — convenience operator over `performHttpWithResponseOutput`
 * with method preset to `DELETE`. Supports an optional body for APIs that accept
 * one (e.g. bulk-deletion payloads) but does NOT default a Content-Type — the
 * caller sets one explicitly when needed.
 */
export const handleHttpDelete = decodedHandler(HttpDeleteSettings, (action, app, automation) =>
  Effect.gen(function* () {
    const { props } = action
    if (props.url === '') return missingUrl('delete')
    const target = yield* connectedTarget(props, app, automation)
    if ('status' in target) return target
    const bodyResult = yield* Effect.result(serializeActionBody(props.body))
    if (bodyResult._tag === 'Failure') {
      return { status: 'failure', error: bodyResult.failure.message } as const
    }
    return yield* performHttpWithResponseOutput({
      url: target.url,
      credentialHeaders: target.merged.credentialHeaders,
      method: 'DELETE',
      headers: target.merged.headers,
      body: bodyResult.success,
      timeoutMs: timeoutMsOf(props),
    })
  }).pipe(
    Effect.withSpan('automations.handle-http-delete', { attributes: actionAttributes(action) })
  )
)
