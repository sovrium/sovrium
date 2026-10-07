/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A JSON route takes JSON, and nothing else.
 *
 * A browser sends a cross-site request WITHOUT a CORS preflight when its body
 * is `text/plain`, `application/x-www-form-urlencoded` or `multipart/form-data`
 * — or carries no type at all — and it attaches the visitor's session cookie
 * wherever SameSite does not stop it. Hono's JSON validator lets such a body
 * through as `{}`, and the handlers re-read it with `c.req.json()` whatever its
 * label, so unguarded, a forged `text/plain` request whose bytes are JSON
 * would create and change records as the signed-in visitor.
 *
 * {@link refuseNonJsonBody} closes that in ONE place, ahead of every handler of
 * the route family it is mounted on: a request that carries a body must label
 * it JSON, or it is answered **415** before anything reads it. The few routes
 * that genuinely take an HTML form post declare it at registration with
 * {@link acceptsFormBody}; they alone may receive the two form encodings, and
 * still never a `text/plain` or untyped body.
 */

import { matchedRoutes } from 'hono/route'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import type { Context, Next } from 'hono'

/** The handlers registered as taking an HTML form post. */
const formBodyHandlers = new WeakSet<object>()

/**
 * Declare that a route takes an HTML form post (`application/x-www-form-urlencoded`
 * or `multipart/form-data`). Wraps nothing: it registers the handler and hands
 * it back, so the declaration sits on the route it governs.
 */
export const acceptsFormBody = <H extends object>(handler: H): H => {
  formBodyHandlers.add(handler)
  return handler
}

const METHODS_WITH_A_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const FORM_MEDIA_TYPES = new Set(['application/x-www-form-urlencoded', 'multipart/form-data'])

/** The media type of a `Content-Type` header, without its parameters. */
const mediaTypeOf = (contentType: string | undefined): string =>
  (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''

const isJsonMediaType = (mediaType: string): boolean =>
  mediaType === 'application/json' || mediaType.endsWith('+json')

/** Does the request carry a body at all? A bodiless POST (`/restore`) is left alone. */
const carriesBody = (c: Context): boolean => {
  if (!METHODS_WITH_A_BODY.has(c.req.method)) return false
  if (c.req.header('transfer-encoding') !== undefined) return true
  const length = Number(c.req.header('content-length') ?? '0')
  return Number.isFinite(length) && length > 0
}

/** Was the route this request reached declared with {@link acceptsFormBody}? */
const routeAcceptsFormBody = (c: Context): boolean =>
  matchedRoutes(c).some((route) => formBodyHandlers.has(route.handler))

/**
 * The middleware body of {@link refuseNonJsonBody}, hoisted so one function
 * serves every mount.
 */
async function refuseNonJsonBodyHandler(c: Context, next: Next) {
  if (!carriesBody(c)) return next()
  const mediaType = mediaTypeOf(c.req.header('content-type'))
  if (isJsonMediaType(mediaType)) return next()
  if (FORM_MEDIA_TYPES.has(mediaType) && routeAcceptsFormBody(c)) return next()
  return c.json(
    {
      success: false,
      message: 'Unsupported media type: send the request body as application/json',
      code: ApiErrorCode.UNSUPPORTED_MEDIA_TYPE,
    },
    415
  )
}

/**
 * Refuse, with 415, a request body that is not labelled JSON — unless the route
 * declared an HTML form post and the body is one.
 */
export function refuseNonJsonBody() {
  return refuseNonJsonBodyHandler
}
