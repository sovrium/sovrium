/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How large a request body an `/api/*` route accepts.
 *
 * The listener's own ceiling (`resolveMaxRequestBodySize` in `request-body-ceiling.ts`)
 * is sized for the largest file the deployment accepts — 101 MiB with the
 * defaults — because Bun applies it to every route alike. Left at that, a
 * sign-in form or any public JSON endpoint could be made to buffer a hundred
 * megabytes per request.
 *
 * So every `/api/*` route, `/api/auth/*` included, runs under
 * `API_BODY_LIMIT_BYTES` (1 MiB by default), refused `413` before the route
 * reads a byte: Hono's `bodyLimit` trusts a `Content-Length` and counts a
 * chunked stream. The routes that take a file keep the listener's upload-sized
 * ceiling, and say so where they are registered, with
 * {@link acceptsUploadBody}. An HTML form post ({@link routeAcceptsFormBody})
 * is upload-sized too: its fields may carry files.
 */

import { bodyLimit } from 'hono/body-limit'
import { matchedRoutes } from 'hono/route'
import { ApiErrorCode } from '@/domain/models/api/error'
import { parsePositiveIntEnv } from '@/domain/models/process-env/positive-int-env'
import { routeAcceptsFormBody } from '@/presentation/api/middleware/json-body'
import type { Context, MiddlewareHandler } from 'hono'

/** The body limit of every non-upload `/api/*` route when `API_BODY_LIMIT_BYTES` is unset (1 MiB). */
export const DEFAULT_API_BODY_LIMIT_BYTES = 1024 * 1024

/** The handlers registered as taking a file upload. */
const uploadBodyHandlers = new WeakSet<object>()

/**
 * Declare that a route takes a file, so its body may be as large as the
 * listener admits. Wraps nothing: it registers the handler and hands it back,
 * so the declaration sits on the route it governs.
 */
export const acceptsUploadBody = <H extends object>(handler: H): H => {
  uploadBodyHandlers.add(handler)
  return handler
}

/** Was the route this request reached declared as taking a file or a form post? */
const routeTakesUploadSizedBody = (c: Context): boolean =>
  routeAcceptsFormBody(c) || matchedRoutes(c).some((route) => uploadBodyHandlers.has(route.handler))

/** The refusal, in the API error envelope every other `/api/*` refusal uses. */
const payloadTooLarge = (c: Context): Response =>
  c.json(
    {
      success: false,
      message: 'Payload too large',
      code: ApiErrorCode.PAYLOAD_TOO_LARGE,
    },
    413
  )

/** `API_BODY_LIMIT_BYTES`, or 1 MiB. */
export const apiBodyLimitBytes = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number => parsePositiveIntEnv(env['API_BODY_LIMIT_BYTES']) ?? DEFAULT_API_BODY_LIMIT_BYTES

/**
 * The `/api/*` body limit: `maxSize` bytes, except on a route that takes a file.
 */
export const apiBodyLimit = (maxSize: number): MiddlewareHandler => {
  const limit = bodyLimit({ maxSize, onError: payloadTooLarge })
  return async (c, next) => (routeTakesUploadSizedBody(c) ? next() : limit(c, next))
}

/**
 * A tighter limit for one route that takes a form post: a form route is
 * otherwise upload-sized, which a route taking one small file need not be.
 * Mounted beside the handler, it refuses `413` before the handler reads a byte.
 */
export const formBodyLimit = (maxSize: number): MiddlewareHandler =>
  bodyLimit({ maxSize, onError: payloadTooLarge })
