/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The canonical `/api/*` error envelope built by the LAST-RESORT boundary.
 *
 * Extracted from `server.ts` because `createHonoApp`'s `.onError` is the only
 * caller, and the status-to-code mapping is a table a reader should be able to
 * find without reading a composition root.
 */

import { HTTPException } from 'hono/http-exception'
import type { ApiErrorCode } from '@/domain/models/api/combinators/error'

/** Whether a request path belongs to the machine-facing `/api/*` surface. */
export const isApiPath = (path: string): boolean => path === '/api' || path.startsWith('/api/')

/**
 * Canonical `errorResponseSchema` code for an HTTP status.
 *
 * Keyed on status rather than on the thrown value because `.onError` is the
 * LAST-RESORT boundary: by the time an error reaches it, the only reliable
 * signal is the status an `HTTPException` chose (routes that know more return
 * their envelope directly via the `auth-helpers` helpers). 504 maps to
 * `SERVICE_UNAVAILABLE` — the enum's "upstream did not answer" category; there
 * is deliberately no separate `GATEWAY_TIMEOUT` code.
 */
const API_ERROR_CODE_BY_STATUS: Readonly<Record<number, ApiErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
  504: 'SERVICE_UNAVAILABLE',
}

export const apiErrorCodeForStatus = (status: number): ApiErrorCode =>
  API_ERROR_CODE_BY_STATUS[status] ?? 'INTERNAL_ERROR'

/**
 * Operator-safe message for the `/api/*` envelope.
 *
 * An `HTTPException`'s message is deliberate, caller-authored text (e.g.
 * `hono/timeout`'s "Gateway Timeout"), so it is safe to surface. An unexpected
 * throw's message is NOT — it can carry a stack, a query, or a connection
 * string — so it is replaced with a fixed string (S4: never return raw
 * internals). The full error still reaches the logs and the telemetry backend.
 */
export const apiErrorMessage = (error: unknown, status: number): string => {
  if (error instanceof HTTPException && error.message.length > 0) return error.message
  return status === 500 ? 'Internal server error' : 'Request failed'
}
