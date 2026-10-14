/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Stream } from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/http'
import { EgressPolicy, EgressTimeoutError } from '@/infrastructure/egress/bounded-http-client'
import { createEventStreamReader, messagesOf } from './mcp-json-rpc'
import type { HttpClientResponse, HttpClientError } from 'effect/http'

/**
 * The one HTTP seam of the MCP client: a single POST, bounded in time and in
 * size, that never follows a redirect.
 *
 * ## Over the bounded client
 *
 * [internal ref] D5 puts every Effect `HttpClient` egress on one bounded layer,
 * `boundedHttpClientLayer`. The client speaks to {@link McpHttpPost} — a
 * function type, so a unit test can hand it a fake — and
 * {@link makeMcpHttpTransport} implements it over the `HttpClient` that layer
 * provides, with an {@link EgressPolicy} that never retries (a `tools/call` may
 * write, and the client reconnects on its own) and never follows a redirect.
 *
 * ## The deadline covers the whole exchange
 *
 * The bounded layer's deadline stops at the response headers, and a Streamable
 * HTTP server may answer `200 text/event-stream` at once and send the JSON-RPC
 * response later — a header deadline would bound nothing. So the request and
 * the body read run under one `Effect.timeoutOrElse`: interrupting the body
 * read aborts the request, the socket closes, the caller gets a typed timeout.
 *
 * A `tools/call` goes through {@link McpHttpOpen} instead, whose messages are
 * read as they arrive: a server may ask the person a question on the open
 * stream (`elicitation/create`) and wait for her answer before it sends the
 * result, so only the response headers sit under the request deadline and the
 * caller bounds each wait for a message.
 *
 * ## No redirects, and only declared origins
 *
 * `redirect: 'manual'` hands a 3xx back as itself; it is reported as a failure,
 * never followed — a declared host answering `307 → http://169.254.169.254/`
 * is the whole attack. And a request whose origin is not one of the declared
 * servers' is refused before it is sent: the host allowlist is the operator's
 * list, nothing else.
 */

/** One JSON-RPC POST to a declared server. */
export interface McpHttpRequest {
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
  readonly timeoutMs: number
}

/** The answer, its body already read (within the size cap). */
export interface McpHttpResponse {
  readonly status: number
  readonly contentType: string
  readonly sessionId: string | undefined
  readonly body: string
}

/** Why a POST produced no usable answer. Messages never carry a header value. */
export type McpHttpFailureKind =
  /** Connection refused, reset, DNS, TLS — the server was not reached. */
  | 'network'
  /** Abandoned at the deadline. */
  | 'timeout'
  /** Answered 3xx; not followed. */
  | 'redirect'
  /** Answered more than {@link MCP_HTTP_MAX_BODY_BYTES}. */
  | 'too-large'
  /** The URL is not one of the declared servers'. */
  | 'not-allowed'

export class McpHttpFailure extends Data.TaggedError('McpHttpFailure')<{
  readonly kind: McpHttpFailureKind
  readonly message: string
}> {}

/** The transport the client speaks to; a unit test hands it a fake. */
export type McpHttpPost = (
  request: McpHttpRequest
) => Effect.Effect<McpHttpResponse, McpHttpFailure>

/**
 * An answer whose JSON-RPC messages are read AS THEY ARRIVE — a `tools/call`
 * whose server asks a question on the open stream before it answers.
 * `messages` may be run once; running it to its end, or interrupting it,
 * closes the connection.
 */
export interface McpHttpStreamResponse {
  readonly status: number
  readonly contentType: string
  readonly sessionId: string | undefined
  readonly messages: Stream.Stream<unknown, McpHttpFailure>
}

/**
 * The streamed transport: `timeoutMs` bounds the response HEADERS only — the
 * caller bounds each wait for a message, since part of the stream's life may
 * be spent waiting on a person, not on the server.
 */
export type McpHttpOpen = (
  request: McpHttpRequest
) => Effect.Effect<McpHttpStreamResponse, McpHttpFailure>

/** {@link McpHttpOpen} over a whole-body {@link McpHttpPost}: the messages once the body is read. */
export const openViaPost =
  (post: McpHttpPost): McpHttpOpen =>
  (request) =>
    Effect.map(post(request), (response) => ({
      status: response.status,
      contentType: response.contentType,
      sessionId: response.sessionId,
      messages: Stream.fromIterable(messagesOf(response.contentType, response.body)),
    }))

/** The largest answer read, in bytes. A tool list or a tool result is far smaller. */
export const MCP_HTTP_MAX_BODY_BYTES = 4 * 1024 * 1024

const failure = (kind: McpHttpFailureKind, message: string): McpHttpFailure =>
  new McpHttpFailure({ kind, message })

const describeNetworkError = (cause: unknown): string => {
  const code =
    typeof cause === 'object' && cause !== null && 'code' in cause
      ? String((cause as { readonly code: unknown }).code)
      : undefined
  return code === undefined
    ? 'the server could not be reached'
    : `the server could not be reached (${code})`
}

/** A client failure, as the MCP client reports it: never a header value. */
const fromClientError = (
  error: HttpClientError.HttpClientError,
  timeoutMs: number
): McpHttpFailure => {
  const cause = 'cause' in error.reason ? error.reason.cause : undefined
  return cause instanceof EgressTimeoutError
    ? failure('timeout', `the server did not answer within ${timeoutMs} ms`)
    : failure('network', describeNetworkError(cause))
}

/** The body, read within {@link MCP_HTTP_MAX_BODY_BYTES}; past it, the read stops. */
const readCapped = (
  response: HttpClientResponse.HttpClientResponse,
  timeoutMs: number
): Effect.Effect<string, McpHttpFailure> =>
  response.stream.pipe(
    Stream.mapError((error) => fromClientError(error, timeoutMs)),
    Stream.runFoldEffect(
      (): { readonly chunks: readonly Uint8Array[]; readonly total: number } => ({
        chunks: [],
        total: 0,
      }),
      (acc, chunk) => {
        const total = acc.total + chunk.byteLength
        return total > MCP_HTTP_MAX_BODY_BYTES
          ? Effect.fail(
              failure('too-large', `the server answered more than ${MCP_HTTP_MAX_BODY_BYTES} bytes`)
            )
          : Effect.succeed({ chunks: [...acc.chunks, chunk], total })
      }
    ),
    Effect.map(({ chunks }) => new TextDecoder().decode(Buffer.concat(chunks)))
  )

/** A 3xx is reported, never followed; anything else is read. */
const readAnswer = (
  response: HttpClientResponse.HttpClientResponse,
  timeoutMs: number
): Effect.Effect<McpHttpResponse, McpHttpFailure> =>
  response.status >= 300 && response.status < 400
    ? Effect.fail(
        failure(
          'redirect',
          `the server answered with a redirect (HTTP ${response.status}); redirects are never followed`
        )
      )
    : Effect.map(readCapped(response, timeoutMs), (body) => ({
        status: response.status,
        contentType: response.headers['content-type'] ?? '',
        sessionId: response.headers['mcp-session-id'] ?? undefined,
        body,
      }))

/** Whether `url` is one of `allowedOrigins`'; a refusal is the failure to send. */
const refuseUndeclared = (
  url: string,
  allowedOrigins: ReadonlySet<string>
): McpHttpFailure | undefined => {
  const origin = URL.canParse(url) ? new URL(url).origin : ''
  return allowedOrigins.has(origin)
    ? undefined
    : failure('not-allowed', 'the address is not one of the declared MCP servers')
}

/**
 * Send `request` over `client` and hand its response to `read`, the whole
 * exchange bounded by `request.timeoutMs`: never retried, never redirected.
 */
const exchange = <A>(
  client: HttpClient.HttpClient,
  request: McpHttpRequest,
  read: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, McpHttpFailure>
): Effect.Effect<A, McpHttpFailure> =>
  client
    .execute(
      HttpClientRequest.post(request.url).pipe(
        HttpClientRequest.setHeaders(request.headers),
        HttpClientRequest.bodyText(request.body, 'application/json')
      )
    )
    .pipe(
      Effect.mapError((error) => fromClientError(error, request.timeoutMs)),
      Effect.flatMap(read),
      Effect.provideService(EgressPolicy, {
        retry: false,
        redirect: 'manual',
        timeoutMs: request.timeoutMs,
      }),
      Effect.timeoutOrElse({
        duration: request.timeoutMs,
        orElse: () =>
          Effect.fail(
            failure('timeout', `the server did not answer within ${request.timeoutMs} ms`)
          ),
      })
    )

/**
 * {@link McpHttpPost} over `client`, restricted to `allowedOrigins` — the
 * origins of the declared servers.
 */
export const httpClientMcpHttpPost =
  (client: HttpClient.HttpClient, allowedOrigins: ReadonlySet<string>): McpHttpPost =>
  (request) => {
    const refused = refuseUndeclared(request.url, allowedOrigins)
    return refused !== undefined
      ? Effect.fail(refused)
      : exchange(client, request, (response) => readAnswer(response, request.timeoutMs))
  }

/**
 * The messages of `response`'s body, each as soon as it is complete, within
 * {@link MCP_HTTP_MAX_BODY_BYTES}. An event stream is read event by event; a
 * JSON body once whole. One run only: the reader keeps its place.
 */
const messagesStream = (
  response: HttpClientResponse.HttpClientResponse,
  timeoutMs: number
): Stream.Stream<unknown, McpHttpFailure> => {
  const contentType = response.headers['content-type'] ?? ''
  const streamed = contentType.toLowerCase().includes('text/event-stream')
  const reader = createEventStreamReader()
  const decoder = new TextDecoder()
  let total = 0
  let whole = ''
  const take = (chunk: Uint8Array): Effect.Effect<readonly unknown[], McpHttpFailure> => {
    total += chunk.byteLength
    if (total > MCP_HTTP_MAX_BODY_BYTES) {
      return Effect.fail(
        failure('too-large', `the server answered more than ${MCP_HTTP_MAX_BODY_BYTES} bytes`)
      )
    }
    const text = decoder.decode(chunk, { stream: true })
    if (streamed) return Effect.succeed(reader.feed(text))
    whole += text
    return Effect.succeed([])
  }
  const rest = Stream.suspend(() =>
    Stream.fromIterable(streamed ? reader.end() : messagesOf(contentType, whole + decoder.decode()))
  )
  return response.stream.pipe(
    Stream.mapError((error) => fromClientError(error, timeoutMs)),
    Stream.mapEffect(take),
    Stream.flatMap((messages) => Stream.fromIterable(messages)),
    Stream.concat(rest)
  )
}

/**
 * {@link McpHttpOpen} over `client`, restricted to `allowedOrigins`. The
 * deadline covers the response headers; the body is the caller's to bound.
 */
export const httpClientMcpHttpOpen =
  (client: HttpClient.HttpClient, allowedOrigins: ReadonlySet<string>): McpHttpOpen =>
  (request) => {
    const refused = refuseUndeclared(request.url, allowedOrigins)
    if (refused !== undefined) return Effect.fail(refused)
    return exchange(client, request, (response) =>
      response.status >= 300 && response.status < 400
        ? Effect.fail(
            failure(
              'redirect',
              `the server answered with a redirect (HTTP ${response.status}); redirects are never followed`
            )
          )
        : Effect.succeed({
            status: response.status,
            contentType: response.headers['content-type'] ?? '',
            sessionId: response.headers['mcp-session-id'] ?? undefined,
            messages: messagesStream(response, request.timeoutMs),
          })
    )
  }

/** Both transports over the `HttpClient` in context — the bounded one. */
export const makeMcpHttpTransport = (
  allowedOrigins: ReadonlySet<string>
): Effect.Effect<
  { readonly post: McpHttpPost; readonly open: McpHttpOpen },
  never,
  HttpClient.HttpClient
> =>
  Effect.map(Effect.service(HttpClient.HttpClient), (client) => ({
    post: httpClientMcpHttpPost(client, allowedOrigins),
    open: httpClientMcpHttpOpen(client, allowedOrigins),
  }))
