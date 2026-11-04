/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The last-resort answers `createHonoApp` attaches after every route: the
 * not-found handler and the error boundary.
 *
 * Extracted from `compose-hono-app.ts` so the composition root reads as its
 * phases. This file may not import presentation — only `compose-hono-app.ts`
 * may — so the canonical API 404 body arrives as a parameter from the root.
 */

import { HTTPException } from 'hono/http-exception'
import { requestedPath } from '@/domain/kernel/url/requested-path'
import { internalErrorLogSuffix } from '@/infrastructure/logging/internal-error-report'
import { logError } from '@/infrastructure/logging/logger'
import { reportRequestFailure } from '@/infrastructure/logging/request-failure-report'
import { loggedRequestPath } from '@/infrastructure/logging/request-log-path'
import {
  apiErrorCodeForStatus,
  apiErrorMessage,
  isApiPath,
} from '@/infrastructure/server/api-error-envelope'
import type { HonoAppConfig } from '@/application/ports/contracts/hono-app-config'
import type { App } from '@/domain/models/app'
import type { ApiNotFoundBody } from '@/infrastructure/server/app-guard-chain'
import type { Hono, Context as HonoContext } from 'hono'

/** Everything {@link attachErrorBoundary} reads, supplied by `createHonoApp`. */
export interface ErrorBoundaryInputs {
  readonly app: App
  readonly renderNotFoundPage: HonoAppConfig['renderNotFoundPage']
  readonly renderErrorPage: HonoAppConfig['renderErrorPage']
  readonly notFoundBody: ApiNotFoundBody
}

/** The request id the `hono/request-id` middleware set, if it ran. */
const requestIdOf = (id: unknown): string | undefined => (typeof id === 'string' ? id : undefined)

/**
 * Content negotiation by ROUTE FAMILY, not by `Accept` header: `/api/*` is
 * a machine surface and must always answer with the canonical error
 * envelope every other 4xx/5xx uses, so one client-side decoder covers
 * every failure.
 */
const apiErrorAnswer =
  (notFoundBody: ApiNotFoundBody) =>
  (
    c: HonoContext,
    error: Error,
    status: HTTPException['status'],
    internalRequestId: string | undefined
  ): Response => {
    if (status === 404) return c.json(notFoundBody(apiErrorMessage(error, status)), 404)
    return c.json(
      {
        success: false,
        message: apiErrorMessage(error, status),
        code: apiErrorCodeForStatus(status),
        ...(internalRequestId === undefined ? {} : { requestId: internalRequestId }),
      },
      status
    )
  }

/** Attach the not-found handler and the error boundary to the routed app. */
export const attachErrorBoundary = (
  honoWithRoutes: Readonly<Hono>,
  inputs: ErrorBoundaryInputs
): Readonly<Hono> => {
  const { app, renderNotFoundPage, renderErrorPage, notFoundBody } = inputs
  return (
    honoWithRoutes
      // An `/api/*` path no route matches answers the one 404 body every API
      // road answers, as JSON — never the HTML page a browser gets.
      .notFound(async (c) =>
        isApiPath(c.req.path)
          ? c.json(notFoundBody(), 404)
          : c.html(await renderNotFoundPage(app, undefined, requestedPath(c.req.url)), 404)
      )
      .onError(async (error, c) => {
        reportRequestFailure(c.req.raw, error)

        // An `HTTPException` carries its OWN status (and, when the raiser supplied
        // one, its own response). Honour it — this handler REPLACES Hono's default
        // `.onError`, which does exactly that via `if ('getResponse' in err)`.
        // Losing it collapses `hono/timeout`'s `HTTPException(504)` into a
        // hard-coded 500, which is what a production incident looked like.
        const status = error instanceof HTTPException ? error.status : 500
        // A 500's request id goes to the caller, and the operator's log line
        // names the id and either the fix (a failure the operator can fix) or
        // the signature and `sovrium report --request-id` — never an issue address.
        const internalRequestId = status === 500 ? requestIdOf(c.get('requestId')) : undefined
        const kept = internalErrorLogSuffix(error, internalRequestId)
        logError(
          `[server] ${c.req.method} ${loggedRequestPath(c.req.raw, c.req.path)} → ${status}${kept}`,
          error
        )

        // Page routes keep the human-facing rendered error page.
        if (isApiPath(c.req.path)) {
          return apiErrorAnswer(notFoundBody)(c, error, status, internalRequestId)
        }

        // Non-API: an explicitly-bodied `HTTPException` wins (the raiser chose
        // that response); anything else renders the error page.
        if (error instanceof HTTPException && error.res !== undefined) {
          return error.getResponse()
        }
        return c.html(await renderErrorPage(app, undefined, internalRequestId), status)
      })
  )
}
