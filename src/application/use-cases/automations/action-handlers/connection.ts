/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Duration, Effect } from 'effect'
import { HTTP_REQUEST_TIMEOUT_MS } from '@/domain/kernel/time/timeouts'
import { validateOutboundUrl } from '@/infrastructure/egress/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import { buildEnvLookup, resolveEnvInString } from '../resolve-env-vars'
import { resolveConnectionHeaders } from './auth-headers'
import {
  buildOperationRequest,
  nextLinkOf,
  readDotPath,
  retryAfterMs,
  withQueryParam,
  type OperationRequest,
} from './connection-request'
import { actionAttributes, numberProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type { App } from '@/domain/models/app'
import type { ConnectionOperation, OperationPagination } from '@/domain/models/app/connections'

/**
 * `connection/call` — call an operation declared on a connection.
 *
 * The operation names the endpoint once (method, path, typed parameters,
 * pagination); the step names the operation and passes values. This handler
 * places and encodes each value (see `connection-request.ts`), authenticates
 * through the connection exactly as the `http` actions do — static headers for
 * apiKey / basic / bearer, the stored and refreshed token for oauth2 — and
 * answers:
 *
 * - `data`: the decoded body; with `paginate`, the items of every page read,
 *   concatenated in order;
 * - `response`: `{ status, headers }` of the last answer.
 *
 * A non-2xx answer FAILS the step, naming the operation and the status: an
 * error body in `data` of a "completed" step is exactly what an operator
 * cannot see. A 429 or 503 carrying `Retry-After` is retried after the delay
 * the service asked for (up to {@link MAX_RATE_LIMIT_RETRIES} times, never
 * waiting longer than {@link MAX_RETRY_AFTER_MS}); every request passes the
 * same outbound-address guard and per-request timeout as the `http` actions.
 */

/** How many times one page is retried after a rate-limit answer. */
const MAX_RATE_LIMIT_RETRIES = 3

/** The longest `Retry-After` honoured; a longer ask fails the step instead of wedging the run. */
const MAX_RETRY_AFTER_MS = 60_000

/** The largest response body read, per page — past it the step fails rather than truncating JSON. */
const RESPONSE_BODY_LIMIT = 5 * 1024 * 1024

/** Hard stop for `paginate: all`, so a service that always names a next page cannot loop forever. */
const MAX_PAGES = 1000

/** A request that never produced an answer: blocked address, timeout, network error. */
class ConnectionCallError extends Data.TaggedError('ConnectionCallError')<{
  readonly message: string
}> {}

/** One answer, decoded. */
interface PageAnswer {
  readonly oversize: boolean
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: unknown
  readonly retryAfter: string | null
  readonly link: string | null
}

const decodeBody = (text: string): unknown => {
  if (text === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const readAnswer = async (response: Response): Promise<PageAnswer> => {
  const text = await response.text()
  const oversize = text.length > RESPONSE_BODY_LIMIT
  return {
    oversize,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: oversize ? undefined : decodeBody(text),
    retryAfter: response.headers.get('retry-after'),
    link: response.headers.get('link'),
  }
}

/** Send one request, once. The outbound guard runs before any byte leaves. */
const sendOnce = (
  request: OperationRequest,
  timeoutMs: number
): Effect.Effect<PageAnswer, ConnectionCallError> => {
  const validation = validateOutboundUrl(request.url)
  if (!validation.ok) {
    return Effect.fail(
      new ConnectionCallError({ message: `invalid_outbound_url_${validation.issue.reason}` })
    )
  }
  return Effect.tryPromise({
    try: async () =>
      readAnswer(
        await withFetchTimeout(
          request.url,
          {
            method: request.method,
            headers: request.headers,
            ...(request.body !== undefined ? { body: request.body } : {}),
          },
          timeoutMs
        )
      ),
    catch: (error) =>
      new ConnectionCallError({ message: error instanceof Error ? error.message : String(error) }),
  }).pipe(
    Effect.filterOrFail(
      (answer) => !answer.oversize,
      () =>
        new ConnectionCallError({
          message: `the response body exceeds ${String(RESPONSE_BODY_LIMIT)} characters`,
        })
    )
  )
}

/** Send one request, waiting out a `Retry-After` on 429 / 503 and trying again. */
const sendWithRateLimitRetry = (
  request: OperationRequest,
  timeoutMs: number,
  retriesLeft: number = MAX_RATE_LIMIT_RETRIES
): Effect.Effect<PageAnswer, ConnectionCallError> =>
  sendOnce(request, timeoutMs).pipe(
    Effect.flatMap((answer) => {
      const limited = answer.status === 429 || answer.status === 503
      const delay = limited ? retryAfterMs(answer.retryAfter, Date.now()) : undefined
      if (delay === undefined || retriesLeft <= 0 || delay > MAX_RETRY_AFTER_MS) {
        return Effect.succeed(answer)
      }
      return Effect.sleep(Duration.millis(delay)).pipe(
        Effect.flatMap(() => sendWithRateLimitRetry(request, timeoutMs, retriesLeft - 1))
      )
    })
  )

/** The items of one page, per the operation's pagination. */
const itemsOf = (pagination: OperationPagination, body: unknown): readonly unknown[] => {
  const items = pagination.itemsPath === undefined ? body : readDotPath(body, pagination.itemsPath)
  return Array.isArray(items) ? items : []
}

const isPresent = (value: unknown): boolean => value !== undefined && value !== null && value !== ''

/** Where the reader stands: the URL just read, and the page number / offset it carried. */
interface PagePosition {
  readonly url: string
  readonly page: number
  readonly offset: number
}

/**
 * A `Link: rel="next"` URL, resolved against the page just read and kept only
 * when it stays on the same origin: the request carries the connection's
 * credentials, and a next link pointing elsewhere must not receive them.
 */
const sameOriginLink = (current: string, next: string | undefined): string | undefined => {
  if (next === undefined) return undefined
  try {
    const resolved = new URL(next, current)
    return resolved.origin === new URL(current).origin ? resolved.toString() : undefined
  } catch {
    return undefined
  }
}

/** The 'page' style: the page number the response names, else the one after. */
const nextPageNumberUrl = (
  pagination: Extract<OperationPagination, { readonly style: 'page' }>,
  current: PagePosition,
  body: unknown,
  items: readonly unknown[]
): string | undefined => {
  if (pagination.nextPath !== undefined) {
    const next = readDotPath(body, pagination.nextPath)
    return isPresent(next)
      ? withQueryParam(current.url, pagination.pageParam, String(next))
      : undefined
  }
  return items.length === 0
    ? undefined
    : withQueryParam(current.url, pagination.pageParam, String(current.page + 1))
}

/** The URL of the page after `answer`, or `undefined` when it was the last one. */
const nextPageUrl = (
  pagination: OperationPagination,
  current: PagePosition,
  answer: PageAnswer
): string | undefined => {
  const items = itemsOf(pagination, answer.body)
  switch (pagination.style) {
    case 'page':
      return nextPageNumberUrl(pagination, current, answer.body, items)
    case 'offset':
      return items.length < pagination.limit
        ? undefined
        : withQueryParam(
            current.url,
            pagination.offsetParam,
            String(current.offset + pagination.limit)
          )
    case 'cursor': {
      const cursor = readDotPath(answer.body, pagination.cursorPath)
      return isPresent(cursor)
        ? withQueryParam(current.url, pagination.cursorParam, String(cursor))
        : undefined
    }
    case 'link':
      return sameOriginLink(current.url, nextLinkOf(answer.link))
    case 'lastItem':
      return afterLastItemUrl(pagination, current.url, answer.body, items)
  }
}

/**
 * The 'lastItem' style: the next page is asked for with the id of the last item
 * just read (`starting_after`). It ends on an empty page, or — when the
 * operation names one — on a `hasMorePath` answering false, which is what spares
 * the extra request an empty page would cost.
 */
const afterLastItemUrl = (
  pagination: Extract<OperationPagination, { readonly style: 'lastItem' }>,
  url: string,
  body: unknown,
  items: readonly unknown[]
): string | undefined => {
  if (items.length === 0) return undefined
  if (pagination.hasMorePath !== undefined && readDotPath(body, pagination.hasMorePath) === false) {
    return undefined
  }
  const lastId = readDotPath(items[items.length - 1], pagination.idField ?? 'id')
  return isPresent(lastId) ? withQueryParam(url, pagination.afterParam, String(lastId)) : undefined
}

/** The first page's URL: the page / offset parameters set to their start values. */
const firstPageUrl = (pagination: OperationPagination, url: string): string => {
  if (pagination.style === 'page') {
    return withQueryParam(url, pagination.pageParam, String(pagination.startPage ?? 1))
  }
  if (pagination.style === 'offset') {
    return withQueryParam(
      withQueryParam(url, pagination.offsetParam, '0'),
      pagination.limitParam,
      String(pagination.limit)
    )
  }
  return url
}

interface CallResult {
  readonly answer: PageAnswer
  readonly items: readonly unknown[]
}

const isSuccessStatus = (status: number): boolean => status >= 200 && status < 300

const failedCall = (label: string, answer: PageAnswer): ActionOutcome => {
  const excerpt =
    typeof answer.body === 'string' ? answer.body : (JSON.stringify(answer.body) ?? '')
  const suffix = excerpt === '' ? '' : ` — ${excerpt.slice(0, 200)}`
  return {
    status: 'failure',
    error: `operation ${label} failed: HTTP ${String(answer.status)}${suffix}`,
    output: { response: { status: answer.status, headers: answer.headers }, data: answer.body },
  }
}

/**
 * Read pages until the last one or until `maxPages`, stopping — and handing
 * the failing answer back — at the first non-2xx.
 */
const readPages = (input: {
  readonly request: OperationRequest
  readonly pagination: OperationPagination
  readonly maxPages: number
  readonly timeoutMs: number
}): Effect.Effect<CallResult, ConnectionCallError> => {
  const { request, pagination, maxPages, timeoutMs } = input
  const step = (
    position: PagePosition,
    read: number,
    items: readonly unknown[]
  ): Effect.Effect<CallResult, ConnectionCallError> =>
    sendWithRateLimitRetry({ ...request, url: position.url }, timeoutMs).pipe(
      Effect.flatMap((answer) => {
        if (!isSuccessStatus(answer.status)) return Effect.succeed({ answer, items })
        const all = [...items, ...itemsOf(pagination, answer.body)]
        const next = read + 1 >= maxPages ? undefined : nextPageUrl(pagination, position, answer)
        if (next === undefined) return Effect.succeed({ answer, items: all })
        const offset =
          pagination.style === 'offset' ? position.offset + pagination.limit : position.offset
        return step({ url: next, page: position.page + 1, offset }, read + 1, all)
      })
    )
  const page = pagination.style === 'page' ? (pagination.startPage ?? 1) : 1
  return step({ url: firstPageUrl(pagination, request.url), page, offset: 0 }, 0, [])
}

type ConnectionWithOperations = {
  readonly name: string
  readonly type: string
  readonly baseUrl?: string | undefined
  readonly props: Record<string, unknown>
  readonly operations?: ReadonlyArray<ConnectionOperation> | undefined
}

const findOperation = (
  app: App,
  connectionName: string,
  operationName: string
):
  | { readonly connection: ConnectionWithOperations; readonly operation: ConnectionOperation }
  | { readonly error: string } => {
  const connections = (app.connections ?? []) as ReadonlyArray<ConnectionWithOperations>
  const connection = connections.find((candidate) => candidate.name === connectionName)
  if (connection === undefined) {
    return { error: `connection ${connectionName}: not found in app config` }
  }
  const operation = connection.operations?.find((candidate) => candidate.name === operationName)
  if (operation === undefined) {
    return { error: `connection ${connectionName}: operation '${operationName}' is not declared` }
  }
  return { connection, operation }
}

const TOKEN_FIELD_REF = /^\$token\.([a-z_][a-z0-9_]*)/

/**
 * The connection's API root: literal, `$env.VAR`, or `$token.FIELD` read from
 * the fields the provider returned with the stored token.
 */
const resolveBaseUrl = (
  app: App,
  baseUrl: string,
  tokenFields: Readonly<Record<string, string>> | undefined
): { readonly ok: true; readonly url: string } | { readonly ok: false; readonly error: string } => {
  const field = baseUrl.match(TOKEN_FIELD_REF)?.[1]
  if (field !== undefined) {
    const value = tokenFields?.[field]
    return value === undefined || value === ''
      ? { ok: false, error: `the stored token carries no ${field}; reconnect the connection` }
      : { ok: true, url: baseUrl.replace(TOKEN_FIELD_REF, value) }
  }
  return { ok: true, url: resolveEnvInString(baseUrl, buildEnvLookup(app.env, process.env)) }
}

const paginateBound = (raw: unknown): number | undefined => {
  if (raw === 'all') return MAX_PAGES
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1
    ? Math.min(raw, MAX_PAGES)
    : undefined
}

const timeoutOf = (props: Readonly<Record<string, unknown>>): number =>
  Math.min(Math.max(numberProp(props, 'timeout', HTTP_REQUEST_TIMEOUT_MS), 1000), 120_000)

/** Send the call — one page, or every page up to the bound — and shape the outcome. */
const performCall = (input: {
  readonly label: string
  readonly request: OperationRequest
  readonly operation: ConnectionOperation
  readonly bound: number | undefined
  readonly timeoutMs: number
}): Effect.Effect<ActionOutcome> =>
  Effect.gen(function* () {
    const { label, request, operation, bound, timeoutMs } = input
    const paginated = bound !== undefined && operation.pagination !== undefined
    const outcome = yield* Effect.result(
      paginated && operation.pagination !== undefined
        ? readPages({ request, pagination: operation.pagination, maxPages: bound, timeoutMs })
        : sendWithRateLimitRetry(request, timeoutMs).pipe(
            Effect.map((answer): CallResult => ({ answer, items: [] }))
          )
    )
    if (outcome._tag === 'Failure') {
      return {
        status: 'failure',
        error: `operation ${label} failed: ${outcome.failure.message}`,
      } as const
    }
    const { answer, items } = outcome.success
    if (!isSuccessStatus(answer.status)) return failedCall(label, answer)
    return {
      status: 'success',
      output: {
        data: paginated ? items : answer.body,
        response: { status: answer.status, headers: answer.headers },
      },
    } as const
  })

export const handleConnectionCall: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const connectionName = stringProp(props, 'connection')
    const operationName = stringProp(props, 'operation')
    const label = `${connectionName}.${operationName}`
    const found = findOperation(app, connectionName, operationName)
    if ('error' in found) return { status: 'failure', error: found.error } as const
    const { connection, operation } = found

    const auth = yield* resolveConnectionHeaders(app, automation, {}, connectionName)
    if (auth.error !== undefined) return { status: 'failure', error: auth.error } as const
    const base = resolveBaseUrl(app, connection.baseUrl ?? '', auth.tokenFields)
    if (!base.ok) {
      return { status: 'failure', error: `connection ${connectionName}: ${base.error}` } as const
    }

    const params = (props['params'] as Record<string, unknown> | undefined) ?? {}
    const built = buildOperationRequest({ baseUrl: base.url, operation, params })
    if (!built.ok) {
      return { status: 'failure', error: `operation ${label}: ${built.error}` } as const
    }
    return yield* performCall({
      label,
      request: { ...built.request, headers: { ...built.request.headers, ...auth.headers } },
      operation,
      bound: paginateBound(props['paginate']),
      timeoutMs: timeoutOf(props),
    })
  }).pipe(
    Effect.withSpan('automations.handle-connection-call', { attributes: actionAttributes(action) })
  )
