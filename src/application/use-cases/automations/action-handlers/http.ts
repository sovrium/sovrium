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
import type { ActionHandler, ActionOutcome, BodySerializationError } from './shared'

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
    const bodyResult = yield* Effect.either(serializeActionBody(props['body']))
    if (bodyResult._tag === 'Left') {
      return { status: 'failure', error: bodyResult.left.message } as const
    }
    return yield* Effect.promise(() =>
      performHttpWithResponseOutput(url, method, merged.headers, bodyResult.right)
    )
  })

const readResponseBodySafe = async (response: Response): Promise<string | undefined> => {
  try {
    return (await response.text()).slice(0, 65_536)
  } catch {
    return undefined
  }
}

const performHttpWithResponseOutput = async (
  url: string,
  method: string,
  headers: Record<string, string>,
  requestBody?: string
): Promise<ActionOutcome> => {
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
      HTTP_REQUEST_TIMEOUT_MS
    )
    const body = await readResponseBodySafe(response)
    const responseHeaders: Record<string, string> = Object.fromEntries(response.headers.entries())
    const responseEnvelope = {
      status: response.status,
      headers: responseHeaders,
      ...(body !== undefined ? { body } : {}),
    }
    if (!response.ok) {
      return {
        status: 'failure',
        error: classifyHttpError(response.status, body?.slice(0, 200)),
        output: { response: responseEnvelope },
      }
    }
    return { status: 'success', output: { response: responseEnvelope } }
  } catch (error) {
    return {
      status: 'failure',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

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
    return yield* Effect.promise(() => performHttpWithResponseOutput(url, 'GET', merged.headers))
  })

const hasContentTypeHeader = (headers: Record<string, string>): boolean =>
  Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')

const buildPostRequestBody = (
  rawBody: unknown,
  headers: Record<string, string>
): Effect.Effect<
  { readonly body: string | undefined; readonly headers: Record<string, string> },
  BodySerializationError
> => {
  if (rawBody === undefined) return Effect.succeed({ body: undefined, headers })
  const explicitCt = hasContentTypeHeader(headers)
  if (typeof rawBody === 'string') {
    return Effect.succeed({ body: rawBody, headers })
  }
  return serializeActionBody(rawBody).pipe(
    Effect.map((body) => ({
      body,
      headers: explicitCt ? headers : { ...headers, 'Content-Type': 'application/json' },
    }))
  )
}

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
      const bodyResult = yield* Effect.either(buildPostRequestBody(props['body'], merged.headers))
      if (bodyResult._tag === 'Left') {
        return { status: 'failure', error: bodyResult.left.message } as const
      }
      const { body, headers } = bodyResult.right
      return yield* Effect.promise(() => performHttpWithResponseOutput(url, method, headers, body))
    })

export const handleHttpPost: ActionHandler = makeHttpBodyVerbHandler('POST')

export const handleHttpPut: ActionHandler = makeHttpBodyVerbHandler('PUT')

export const handleHttpPatch: ActionHandler = makeHttpBodyVerbHandler('PATCH')

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
    const bodyResult = yield* Effect.either(serializeActionBody(props['body']))
    if (bodyResult._tag === 'Left') {
      return { status: 'failure', error: bodyResult.left.message } as const
    }
    return yield* Effect.promise(() =>
      performHttpWithResponseOutput(url, 'DELETE', merged.headers, bodyResult.right)
    )
  })
