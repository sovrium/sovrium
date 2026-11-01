/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The guard chain `createHonoApp` mounts first, in its one fixed order.
 *
 * Extracted from `compose-hono-app.ts` so the composition root reads as its
 * phases. The ORDER below is the security contract, and several waves have
 * each placed one link in it on purpose: the domain services lead, then the
 * request id, the security headers and same-origin framing (which only wrap),
 * then `localHostNames` (the first link that can ANSWER), then the preview
 * gate, then the cross-site request guard, then the query-count and catalog
 * boxes. Do not reorder; add a link only with the reason it sits where it does.
 *
 * This file may not import presentation — only `compose-hono-app.ts` may — so
 * the two presentation pieces the chain needs (the cross-site guard and the
 * canonical API 404 body) arrive as parameters from the root.
 */

import { Context } from 'effect'
import { requestId } from 'hono/request-id'
import { ProcessEnv, type ProcessEnvShape } from '@/application/ports/services/process-env'
import { ServerEnv } from '@/application/ports/services/server-env'
import { selfFramedPaths } from '@/domain/models/app/pages/self-framed-paths-service'
import { isDevPublicEnabled, parseDevNoticeEnvConfig } from '@/domain/models/process-env/dev-notice'
import { parseFrameAncestors } from '@/domain/models/process-env/preview'
import { appTrustedOrigins } from '@/infrastructure/auth/better-auth/trusted-origins'
import { isApiPath } from '@/infrastructure/server/api-error-envelope'
import { domainContextMiddleware } from '@/infrastructure/server/domain-runtime'
import { catalogRequestCacheMiddleware } from '@/infrastructure/server/middleware/catalog-request-cache'
import { dbQueryCountMiddleware } from '@/infrastructure/server/middleware/db-query-count-header'
import { localHostNames } from '@/infrastructure/server/middleware/local-host-names'
import { noindexPosture } from '@/infrastructure/server/middleware/noindex-posture'
import { previewGate } from '@/infrastructure/server/middleware/preview-gate'
import {
  sameOriginFraming,
  securityHeadersFor,
} from '@/infrastructure/server/middleware/security-headers'
import type { HonoAppConfig } from '@/application/ports/contracts/hono-app-config'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/server/domain-runtime'
import type { Hono, Context as HonoContext, MiddlewareHandler } from 'hono'

/** The canonical `/api/*` 404 body, supplied by the composition root. */
export type ApiNotFoundBody = (message?: string) => object

/** Everything {@link mountGuardChain} reads, supplied by `createHonoApp`. */
export interface GuardChainInputs {
  readonly app: App
  readonly domainContext: DomainContext
  readonly renderNotFoundPage: HonoAppConfig['renderNotFoundPage']
  readonly notFoundBody: ApiNotFoundBody
  /** `crossSiteRequestGuard`, a presentation middleware factory. */
  readonly crossSiteGuardFor: (trustedOrigins: readonly string[]) => MiddlewareHandler
}

/** The origins `SOVRIUM_FRAME_ANCESTORS` names; the boot check already refused a bad value. */
const framingOriginsOf = (
  env: Readonly<Record<string, string | undefined>>
): readonly string[] | undefined => {
  const parsed = parseFrameAncestors(env['SOVRIUM_FRAME_ANCESTORS'])
  return parsed._tag === 'Origins' ? parsed.origins : undefined
}

/**
 * The platform's ordinary not-found answer of the request's family, drawn
 * WITHOUT the app: the app's own `/404` page can carry its name, navigation,
 * data bindings and analytics beacon, none of which a request the server
 * refuses to serve may see.
 */
const platformNotFound =
  (renderNotFoundPage: HonoAppConfig['renderNotFoundPage'], notFoundBody: ApiNotFoundBody) =>
  async (c: HonoContext): Promise<Response> =>
    isApiPath(c.req.path) ? c.json(notFoundBody(), 404) : c.html(await renderNotFoundPage(), 404)

/**
 * The preview gate when `SOVRIUM_PREVIEW_TOKEN` is set; else the noindex
 * posture when a dev-mode instance is public on purpose (`SOVRIUM_DEV_PUBLIC`);
 * else a pass-through. The gate already wears the posture on what it admits.
 * Its refusal is the platform's ordinary not-found answer of the request's
 * family, drawn WITHOUT the app: the app's own `/404` page can carry its name,
 * navigation, data bindings and analytics beacon, all of which a hidden
 * preview must not show to a request that has not been admitted.
 */
const mountPreviewGate = (
  notFound: (c: HonoContext) => Promise<Response>,
  token: string | undefined,
  env: ProcessEnvShape
): MiddlewareHandler => {
  if (token === undefined) {
    return isDevPublicEnabled(parseDevNoticeEnvConfig(env)) ? noindexPosture : (_c, next) => next()
  }
  return previewGate({ token, notFound })
}

/**
 * Mount the guard chain on `honoApp`, in order.
 *
 * Request correlation ID — mounted right after the domain services so every
 * downstream middleware, route handler, and error handler can read a single
 * stable `c.get('requestId')` (and the response carries an `X-Request-Id`
 * header). Chained with the security headers (HSTS, report-only CSP,
 * Permissions-Policy, X-Frame-Options, nosniff, …) so every response carries
 * them — config + rationale live in ./middleware/security-headers.
 *
 * The per-request DB query-count seam is mounted after the guards so the
 * AsyncLocalStorage box wraps EVERYTHING downstream — Better Auth's
 * /api/auth/* handler, the getSession middleware, the analytics-purge
 * middleware, and every route. The box opens UNCONDITIONALLY (it feeds the
 * `db.query.per_request` histogram and the root-span `db.query.count`
 * attribute); only the client-visible `X-Sovrium-Db-Queries` header is gated
 * by `SOVRIUM_DB_QUERY_HEADER` (default OFF — anti-enumeration, see
 * ./middleware/db-query-count-header).
 *
 * The per-request CATALOG memo follows, needing the same total coverage: the
 * `deleted_at` probes it collapses sit inside repository transactions with no
 * request context of their own. It is unconditional and has no env toggle — it
 * changes no answer, only how many round-trips producing it costs (measured: a
 * record listing goes 9 → 8 statements). See ./middleware/catalog-request-cache.
 *
 * The domain services lead the chain. They are the services `createServer`
 * resolved ONCE from its `ManagedRuntime`, and publishing them per request is
 * what lets a handler write `provideDomain(c, program)` instead of rebuilding
 * its folder's layers on every call. Nothing downstream depends on ordering
 * here — the value is constant for the life of the server — but leading the
 * chain means no route can be registered ahead of it. See ./domain-runtime.
 */
export const mountGuardChain = (
  honoApp: Readonly<Hono>,
  inputs: GuardChainInputs
): Readonly<Hono> => {
  const { app, domainContext, renderNotFoundPage, notFoundBody, crossSiteGuardFor } = inputs
  // This server's environment, as its domain runtime was built with it.
  const env = Context.get(domainContext, ProcessEnv)
  const frameAncestors = framingOriginsOf(env)
  return (
    honoApp
      .use('*', domainContextMiddleware(domainContext))
      .use('*', requestId())
      .use('*', securityHeadersFor(frameAncestors))
      .use('*', sameOriginFraming(selfFramedPaths(app), frameAncestors))
      // A strictly local server answers only the machine's own names: the first
      // link that can ANSWER, so a request under a rebound name reaches nothing,
      // the health route included. See ./middleware/local-host-names.
      .use('*', localHostNames(platformNotFound(renderNotFoundPage, notFoundBody)))
      // The preview gate ([internal ref] D2). Nothing above it answers but the host
      // check (they only wrap), so it judges every request before a cache, a
      // static file, auth, a realtime upgrade or a webhook can.
      .use(
        '*',
        mountPreviewGate(
          platformNotFound(renderNotFoundPage, notFoundBody),
          Context.get(domainContext, ServerEnv).previewToken,
          env
        )
      )
      // A cookie-bearing state change or live subscription another site sent is
      // refused here, ahead of every session lookup and every route — the
      // non-API form posts included. See
      // `presentation/api/middleware/cross-site-request-guard.ts`.
      .use('*', crossSiteGuardFor(appTrustedOrigins(app.auth, app.env)))
      .use('*', dbQueryCountMiddleware())
      .use('*', catalogRequestCacheMiddleware())
  )
}
