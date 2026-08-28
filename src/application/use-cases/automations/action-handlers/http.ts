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
import { numberProp, serializeActionBody, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, BodySerializationError } from './shared'

/**
 * Map an HTTP status code to a stable, low-cardinality error category that
 * downstream consumers (run-history, retry policies, refresh-token logic)
 * can pattern-match without re-parsing free-form messages.
 *
 * 401 is split from a generic 4xx because a token-refresh path needs to
 * distinguish "token expired / scopes insufficient / grant revoked" from
 * "the request itself was malformed". 403 stays separate because it
 * usually signals an authorization problem the user cannot self-resolve
 * by re-auth. 429 is called out so backoff schedulers can branch on it.
 *
 * The `bodyExcerpt` (first 200 chars of the response body, when readable)
 * is included to help operators distinguish the three 401 sub-cases
 * without making them part of the structured error category — IdPs vary
 * widely in what they put in the body, so we surface it instead of
 * trying to classify it.
 */
const classifyHttpError = (status: number, bodyExcerpt: string | undefined): string => {
  const suffix = bodyExcerpt !== undefined && bodyExcerpt !== '' ? ` — ${bodyExcerpt}` : ''
  if (status === 401) return `HTTP 401 unauthorized${suffix}`
  if (status === 403) return `HTTP 403 forbidden${suffix}`
  if (status === 404) return `HTTP 404 not_found${suffix}`
  if (status === 408) return `HTTP 408 request_timeout${suffix}`
  if (status === 429) return `HTTP 429 rate_limited${suffix}`
  if (status >= 500) return `HTTP ${String(status)} upstream_error${suffix}`
  if (status >= 400) return `HTTP ${String(status)} client_error${suffix}`
  return `HTTP ${String(status)}${suffix}`
}

/**
 * The declared `props.timeout` window, in ms. Mirrors the schema's
 * `Schema.between(1000, 120_000)` on all six `http/*` operators.
 *
 * A decoded config can never land outside the window, but the code-action
 * dispatch path (`run/action-invokers.ts`) builds a synthetic action and
 * dispatches it WITHOUT schema validation, so an out-of-range number reaches
 * the handler unchecked. Clamping here — rather than falling back to the
 * default — keeps a `timeout: 200` closest to what the author asked for
 * instead of silently granting it the full 15s.
 */
const HTTP_TIMEOUT_MIN_MS = 1000
const HTTP_TIMEOUT_MAX_MS = 120_000

/**
 * The per-request timeout budget: `props.timeout` when declared, otherwise
 * {@link HTTP_REQUEST_TIMEOUT_MS}.
 *
 * 15 000 ms — not the 30 000 the annotation used to name — is the real
 * fallback, and stays the fallback: honouring the annotation's number instead
 * would silently double the budget of every `http/*` action that declares
 * nothing.
 */
const timeoutMsOf = (props: Readonly<Record<string, unknown>>): number => {
  const declared = numberProp(props, 'timeout', HTTP_REQUEST_TIMEOUT_MS)
  return Math.min(Math.max(Math.trunc(declared), HTTP_TIMEOUT_MIN_MS), HTTP_TIMEOUT_MAX_MS)
}

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
 *. String bodies pass through
 * verbatim; JSON-shaped bodies are stringified on the way out — unless
 * `props.contentType` declares another encoding.
 */
export const handleHttpRequest: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const url = stringProp(props, 'url')
    if (!url) return { status: 'failure', error: 'http.request requires a url' } as const

    const method = String(props['method'] ?? 'GET')
    const baseHeaders = (props['headers'] as Record<string, string> | undefined) ?? {}
    const connectionName = stringProp(props, 'connection')

    const merged =
      connectionName !== ''
        ? yield* resolveConnectionHeaders(app, automation, baseHeaders, connectionName)
        : { headers: baseHeaders }

    if (merged.error !== undefined) {
      return { status: 'failure', error: merged.error } as const
    }
    // `http/request` declares `contentType` but has never defaulted a
    // Content-Type header of its own, so the shorthand is applied only when
    // the config asks for it — an absent `contentType` keeps the historical
    // serialize-and-send-no-header behaviour byte for byte.
    const bodyResult = yield* Effect.result(
      applyContentTypeShorthand(props['body'], merged.headers, shorthandOf(props))
    )
    if (bodyResult._tag === 'Failure') {
      return { status: 'failure', error: bodyResult.failure.message } as const
    }
    const { body, headers } = bodyResult.success
    return yield* Effect.promise(() =>
      performHttpWithResponseOutput({
        url,
        method,
        headers,
        body,
        timeoutMs: timeoutMsOf(props),
      })
    )
  })

/** The hard cap on a captured response body, in UTF-16 code units. */
const RESPONSE_BODY_CAP = 65_536

/** A response body as captured, plus whether the cap cut it short. */
interface CapturedBody {
  readonly body: string | undefined
  readonly truncated: boolean
}

/**
 * Read the response body as text, capped at 64 KiB so a misbehaving
 * upstream cannot swell run-history memory. Failures are swallowed so the
 * handler still surfaces the response status + headers when the body is
 * unreadable (some upstreams reject `.text()` after a particular code path).
 *
 * The cap STAYS — what changes is that hitting it is now reported. Past the
 * cap the JSON parse of the mutilated text fails, so no structured `body` is
 * exposed and the step reports a bare success; nothing distinguished that from
 * an endpoint that genuinely returned nothing (the motivating case being a
 * wide Google Sheets `values.get`). `truncated` is that distinction
 *.
 */
const readResponseBodySafe = async (response: Response): Promise<CapturedBody> => {
  try {
    const text = await response.text()
    return text.length > RESPONSE_BODY_CAP
      ? { body: text.slice(0, RESPONSE_BODY_CAP), truncated: true }
      : { body: text, truncated: false }
  } catch {
    return { body: undefined, truncated: false }
  }
}

/**
 * True when the `Content-Type` header (any casing — RFC 7230 §3.2 makes HTTP
 * field names case-insensitive) declares a JSON media type. Matches the
 * `application/json` family and the `+json` structured-syntax suffix
 * (RFC 6839, e.g. `application/vnd.api+json`).
 */
const isJsonContentType = (headers: Readonly<Record<string, string>>): boolean => {
  const entry = Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type')
  const value = (entry?.[1] ?? '').toLowerCase()
  return value.includes('application/json') || value.includes('+json')
}

/**
 * Attempt to expose a STRUCTURED, JSON-parsed `body` for the response so a
 * later step can read a field via `{{steps.X.body.<key>}}`
 *. The parsed value is
 * only surfaced when the `Content-Type` declares JSON OR the raw text parses
 * as a JSON object/array — primitive JSON (a bare number/string/bool) is not
 * worth a dotted-path lookup and is left out so non-JSON responses keep the
 * raw-text-only contract (…-003 back-compat). Returns `undefined` when no
 * parsed body should be exposed.
 */
const parseJsonResponseBody = (
  body: string | undefined,
  headers: Readonly<Record<string, string>>
): unknown => {
  if (body === undefined || body === '') return undefined
  const looksJson = isJsonContentType(headers)
  try {
    // The response shape is arbitrary upstream JSON (no single schema
    // applies); we expose it as an opaque object for dotted-path templating.
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) return parsed
    // Bare JSON primitive — only surface it when the header explicitly says
    // JSON; otherwise leave non-JSON responses untouched.
    return looksJson ? parsed : undefined
  } catch {
    return undefined
  }
}

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
const performHttpWithResponseOutput = async (input: {
  readonly url: string
  readonly method: string
  readonly headers: Record<string, string>
  readonly body?: string | undefined
  readonly timeoutMs: number
}): Promise<ActionOutcome> => {
  const { url, method, headers, body: requestBody, timeoutMs } = input
  // SSRF guard: reject loopback / link-local / RFC1918 / non-http(s)
  // BEFORE fetch, so a misconfigured automation can't probe internal
  // services through the http/* action handler.
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
        ...(requestBody !== undefined ? { body: requestBody } : {}),
      },
      timeoutMs
    )
    const { body, truncated } = await readResponseBodySafe(response)
    const responseHeaders: Readonly<Record<string, string>> = Object.fromEntries(
      response.headers.entries()
    )
    // `truncated` is emitted only when true: an absent key keeps the envelope
    // of every under-cap response byte-identical to what it has always been.
    const responseEnvelope = {
      status: response.status,
      headers: responseHeaders,
      ...(body !== undefined ? { body } : {}),
      ...(truncated ? { truncated: true } : {}),
    }
    // Expose a STRUCTURED, JSON-parsed `body` ALONGSIDE the raw-text
    // `response.body` so a later step can read a field via
    // `{{steps.X.body.<key>}}` (GAP-18). The raw text stays at
    // `{{steps.X.response.body}}` for back-compat. Non-JSON responses leave
    // `parsedBody` undefined → only the raw envelope is exposed.
    const parsedBody = parseJsonResponseBody(body, responseHeaders)
    const parsedBodyField = parsedBody !== undefined ? { body: parsedBody } : {}
    if (!response.ok) {
      return {
        status: 'failure',
        error: classifyHttpError(response.status, body?.slice(0, 200)),
        output: { response: responseEnvelope, ...parsedBodyField },
      }
    }
    return { status: 'success', output: { response: responseEnvelope, ...parsedBodyField } }
  } catch (error) {
    return {
      status: 'failure',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * `http/get` handler — convenience operator over `performHttpWithResponseOutput`
 * with method preset to `GET`. The schema (`HttpGetActionSchema`) rejects a
 * `body` field at decode time so misuse surfaces in YAML validation; this
 * handler does not look at `props.body` even defensively.
 */
export const handleHttpGet: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const url = stringProp(props, 'url')
    if (!url) return { status: 'failure', error: 'http.get requires a url' } as const

    const baseHeaders = (props['headers'] as Record<string, string> | undefined) ?? {}
    const connectionName = stringProp(props, 'connection')

    const merged =
      connectionName !== ''
        ? yield* resolveConnectionHeaders(app, automation, baseHeaders, connectionName)
        : { headers: baseHeaders }

    if (merged.error !== undefined) {
      return { status: 'failure', error: merged.error } as const
    }
    return yield* Effect.promise(() =>
      performHttpWithResponseOutput({
        url,
        method: 'GET',
        headers: merged.headers,
        timeoutMs: timeoutMsOf(props),
      })
    )
  })

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

const shorthandOf = (
  props: Readonly<Record<string, unknown>>
): ContentTypeShorthand | undefined => {
  const raw = props['contentType']
  return typeof raw === 'string' && raw in CONTENT_TYPE_BY_SHORTHAND
    ? (raw as ContentTypeShorthand)
    : undefined
}

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
 *    than ignoring the field, which is what the handler did before
 *.
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
 * `Content-Type` header. [internal ref]: when the
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
const makeHttpBodyVerbHandler =
  (method: 'POST' | 'PUT' | 'PATCH'): ActionHandler =>
  (action, app, automation) =>
    Effect.gen(function* () {
      const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
      const url = stringProp(props, 'url')
      if (!url)
        return { status: 'failure', error: `http.${method.toLowerCase()} requires a url` } as const

      const baseHeaders = (props['headers'] as Record<string, string> | undefined) ?? {}
      const connectionName = stringProp(props, 'connection')

      const merged =
        connectionName !== ''
          ? yield* resolveConnectionHeaders(app, automation, baseHeaders, connectionName)
          : { headers: baseHeaders }

      if (merged.error !== undefined) {
        return { status: 'failure', error: merged.error } as const
      }
      const bodyResult = yield* Effect.result(
        buildPostRequestBody(props['body'], merged.headers, shorthandOf(props))
      )
      if (bodyResult._tag === 'Failure') {
        return { status: 'failure', error: bodyResult.failure.message } as const
      }
      const { body, headers } = bodyResult.success
      return yield* Effect.promise(() =>
        performHttpWithResponseOutput({
          url,
          method,
          headers,
          body,
          timeoutMs: timeoutMsOf(props),
        })
      )
    })

/**
 * `http/post` handler — convenience operator over `performHttpWithResponseOutput`
 * with method preset to `POST`. Defaults `Content-Type: application/json` for
 * JSON-shaped bodies, but honours an
 * explicit Content-Type override (POST-003).
 */
export const handleHttpPost: ActionHandler = makeHttpBodyVerbHandler('POST')

/** `http/put` handler — like {@link handleHttpPost} but method preset to `PUT` (full resource replacement). */
export const handleHttpPut: ActionHandler = makeHttpBodyVerbHandler('PUT')

/** `http/patch` handler — like {@link handleHttpPost} but method preset to `PATCH` (partial resource update). */
export const handleHttpPatch: ActionHandler = makeHttpBodyVerbHandler('PATCH')

/**
 * `http/delete` handler — convenience operator over `performHttpWithResponseOutput`
 * with method preset to `DELETE`. Supports an optional body for APIs that accept
 * one (e.g. bulk-deletion payloads) but does NOT default a Content-Type — the
 * caller sets one explicitly when needed.
 */
export const handleHttpDelete: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const url = stringProp(props, 'url')
    if (!url) return { status: 'failure', error: 'http.delete requires a url' } as const

    const baseHeaders = (props['headers'] as Record<string, string> | undefined) ?? {}
    const connectionName = stringProp(props, 'connection')

    const merged =
      connectionName !== ''
        ? yield* resolveConnectionHeaders(app, automation, baseHeaders, connectionName)
        : { headers: baseHeaders }

    if (merged.error !== undefined) {
      return { status: 'failure', error: merged.error } as const
    }
    const bodyResult = yield* Effect.result(serializeActionBody(props['body']))
    if (bodyResult._tag === 'Failure') {
      return { status: 'failure', error: bodyResult.failure.message } as const
    }
    return yield* Effect.promise(() =>
      performHttpWithResponseOutput({
        url,
        method: 'DELETE',
        headers: merged.headers,
        body: bodyResult.success,
        timeoutMs: timeoutMsOf(props),
      })
    )
  })
