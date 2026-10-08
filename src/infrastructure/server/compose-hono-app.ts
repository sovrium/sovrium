/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE Hono composition root.
 *
 * One file assembles the application: middleware in mount order, then every
 * route family, then the last-resort error boundary. It is the only place that
 * knows both halves — which is what lets every route module stay ignorant of
 * the others.
 */

import { Context, Effect } from 'effect'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import { AssetStore } from '@/application/ports/services/asset-store'
import { purgeOldAnalyticsData } from '@/application/use-cases/analytics/purge-old-data'
import { requestedPath } from '@/domain/kernel/url/requested-path'
import { resolvesToDeclaredPage } from '@/domain/models/app/pages/page-path-resolvability'
import { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import { createInvitationServices } from '@/infrastructure/auth/better-auth/invitation-services'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import { isLiveReloadEligible } from '@/infrastructure/process/env'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { adminMountsFor } from '@/infrastructure/server/admin-mounts'
import {
  apiErrorCodeForStatus,
  apiErrorMessage,
  isApiPath,
} from '@/infrastructure/server/api-error-envelope'
import { domainContextMiddleware, provideDomain } from '@/infrastructure/server/domain-runtime'
import { resolveAuthContext } from '@/infrastructure/server/hono-auth-context'
import { attachConfigHashSetter } from '@/infrastructure/server/lock-file-cleanup'
import { catalogRequestCacheMiddleware } from '@/infrastructure/server/middleware/catalog-request-cache'
import { dbQueryCountMiddleware } from '@/infrastructure/server/middleware/db-query-count-header'
import { hostRedirect } from '@/infrastructure/server/middleware/host-redirect'
import { requestLogger } from '@/infrastructure/server/middleware/request-logger'
import { securityHeaders } from '@/infrastructure/server/middleware/security-headers'
import { setupStaticAssets } from '@/infrastructure/server/route-setup/static-assets'
import { readStatusDocument } from '@/infrastructure/server/status-file'
import { reportException } from '@/infrastructure/telemetry/error-reporter'
import { createRequestTraceMiddleware } from '@/infrastructure/telemetry/performance-middleware'
import { getTelemetryConfig } from '@/infrastructure/telemetry/telemetry-config'
import { isOperatorActionable } from '@/infrastructure/telemetry/telemetry-sink'
import { makeAdminReadHost } from '@/presentation/api/admin/admin-read-host'
import { setupDesignSystemShareRoutes } from '@/presentation/api/admin/design-system-share-reader-routes'
import { setupAdminMountRoutes } from '@/presentation/api/admin/mount-routes'
import { fireAgentSchedule } from '@/presentation/api/agents/agent-schedule-runner'
import { setupAuthMiddleware } from '@/presentation/api/auth/auth-middleware'
import { setupAuthRoutes } from '@/presentation/api/auth/better-auth-routes'
import { setupOauthConsentRoutes } from '@/presentation/api/auth/oauth-consent-routes'
import { createApiRoutes } from '@/presentation/api/compose-api-routes'
import { setupLinkRoutes } from '@/presentation/api/links/routes'
import { setupMcpRoutes } from '@/presentation/api/mcp/routes'
import { setupOpenApiRoutes } from '@/presentation/api/openapi/routes'
import { setupPageRoutes } from '@/presentation/api/pages/page-routes'
import { setupRedirectRoutes } from '@/presentation/api/pages/redirect-routes'
import { setupSeoRoutes } from '@/presentation/api/pages/seo-routes'
import { notFoundBody } from '@/presentation/api/runtime/auth-helpers'
import { setupBootstrapRoutes } from '@/presentation/api/server/bootstrap-routes'
import { setupDevReloadRoute } from '@/presentation/api/server/dev-reload-routes'
import type { HonoAppConfig } from '@/application/ports/contracts/hono-app-config'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/server/domain-runtime'

/**
 * Mount the per-request trace boundary when EITHER signal that reads it is
 * armed: Sentry performance sampling (`SENTRY_DSN` +
 * `SENTRY_TRACES_SAMPLE_RATE` in `(0,1]`), which turns the box into a
 * transaction envelope, or OTLP traces (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`),
 * which needs the box so a handler running several Effect programs chains them
 * under ONE request root instead of opening a root per program. No-op when
 * neither is armed.
 */
function mountPerformanceMiddleware(honoApp: Readonly<Hono>): void {
  const { performance, traces } = getTelemetryConfig()
  if (performance === undefined && traces === undefined) return
  honoApp.use(
    '*',
    createRequestTraceMiddleware({
      ...(performance !== undefined ? { transactionSampleRate: performance.sampleRate } : {}),
      ...(traces !== undefined ? { traceSampleRatio: traces.sampleRatio } : {}),
    })
  )
}

/**
 * Everything `createHonoApp` takes beyond {@link HonoAppConfig}.
 *
 * `domainContext` is the resolved domain services of the runtime `createServer`
 * owns — a PARAMETER, exactly as the Better Auth instance is, and for the same
 * reason: a server may be booted many times in one process (`serverMode:
 * 'inprocess'`), so nothing about it may live at module scope. It is required
 * rather than optional because every caller has one, and an optional field
 * would let a handler reach a program with no services and discover it as a
 * defect at request time.
 */
interface HonoAppExtras {
  readonly configHash?: string
  readonly domainContext: DomainContext
  /**
   * This app renders a static build (`render-app.ts`) rather than serving
   * requests. A build is never a `--watch` session, so it mounts no dev
   * live-reload surface whatever `NODE_ENV` says — no route, and no tag in
   * the pages it renders.
   */
  readonly staticRender?: boolean
}

/**
 * Creates a Hono application with routes
 *
 * Mounts the following routes:
 * - GET /api/* - API routes (health, tables, records) with RPC type safety
 * - GET /api/openapi.json - Generated OpenAPI specification (application endpoints)
 * - GET /api/auth/openapi.json - Generated OpenAPI specification (authentication endpoints)
 * - GET /api/scalar - Unified Scalar API documentation UI (shows both API and Auth tabs)
 * - POST/GET /api/auth/* - Better Auth authentication endpoints
 * - GET / - Homepage
 * - GET /assets/output.css - Compiled Tailwind CSS
 * - GET /test/error - Test error handler (non-production only)
 *
 * @param config - Configuration object with app data and render functions
 * @returns Configured Hono app instance
 * @knip-ignore - Used by both createServer and createHonoAppForSSG
 */

/**
 * The agent-schedule fire, re-exported from the ONE infrastructure file allowed
 * to name presentation.
 *
 * A pass-through and nothing else, and it earns its place by WHERE it is rather
 * than by what it does. `register-agent-schedules.ts` arms the cron jobs and
 * needs this function; it is not a composition root, so it may not import
 * presentation, and `server.ts` — which calls both — reaches no presentation
 * module at all today and should not start.
 *
 * So the import lands here, beside the other place this file already knows both
 * sides of the boundary, and the registrar takes the function as a parameter.
 * The proper fix is a use-case, and it is not available yet: the runner pulls
 * six siblings out of `presentation/api/agents/`, so the whole agent-run
 * cluster has to move together. See `register-agent-schedules.ts` for that
 * measurement.
 */

/**
 * An `/api/*` path no API route claimed answers the canonical JSON 404 — unless
 * the app itself declares a page there.
 *
 * The prefix names the engine's HTTP API, not a forbidden spelling: a
 * configuration may declare a page at `/api/v1/users/profile`, and that page is
 * served (and emitted by a static build) like any other. So a declared page
 * falls through to the page routes, which also own its access check.
 */
const answerUnmatchedApiPaths =
  (app: App) =>
  (honoApp: Readonly<Hono>): Readonly<Hono> =>
    honoApp.all('/api/*', (c, next) =>
      resolvesToDeclaredPage(app, c.req.path) ? next() : c.json(notFoundBody(), 404)
    )

export { fireAgentSchedule }

export async function createHonoApp(
  config: HonoAppConfig & HonoAppExtras
): Promise<Readonly<Hono>> {
  const { app, renderNotFoundPage, renderErrorPage, configHash } = config

  const { runtime, authInstance, getSession } = await resolveAuthContext(app, config.domainContext)

  const honoApp = new Hono()

  // Request correlation ID — mounted first so every downstream middleware,
  // route handler, and error handler can read a single stable `c.get('requestId')`
  // (and the response carries an `X-Request-Id` header); replaces ad-hoc
  // per-handler `crypto.randomUUID()` minting. Chained with the security
  // headers (HSTS, report-only CSP, Permissions-Policy, X-Frame-Options,
  // nosniff, …) so every response carries them — config + rationale live in
  // ./middleware/security-headers.
  //
  // The third link is the per-request DB query-count seam, mounted right after
  // that pair so the AsyncLocalStorage box wraps EVERYTHING downstream —
  // Better Auth's /api/auth/* handler, the getSession middleware, the
  // analytics-purge middleware, and every route. The box opens
  // UNCONDITIONALLY (it feeds the `db.query.per_request` histogram and the
  // root-span `db.query.count` attribute); only the client-visible
  // `X-Sovrium-Db-Queries` header is gated by `SOVRIUM_DB_QUERY_HEADER`
  // (default OFF — anti-enumeration, see ./middleware/db-query-count-header).
  // It is CHAINED onto the pair above rather than mounted as its own statement
  // so `createHonoApp` stays inside the 20-statement `max-statements` ceiling;
  // the resulting mount order is identical either way.
  //
  // The fourth link is the per-request CATALOG memo, chained for the same
  // reason and needing the same total coverage: the `deleted_at` probes it
  // collapses sit inside repository transactions with no request context of
  // their own. It is unconditional and has no env toggle — it changes no
  // answer, only how many round-trips producing it costs (measured: a record
  // listing goes 9 → 8 statements). See ./middleware/catalog-request-cache.
  //
  // The domain services lead the chain. They are the services `createServer`
  // resolved ONCE from its `ManagedRuntime`, and publishing them per request is
  // what lets a handler write `provideDomain(c, program)` instead of rebuilding
  // its folder's layers on every call. Nothing downstream depends on ordering
  // here — the value is constant for the life of the server — but leading the
  // chain means no route can be registered ahead of it. See ./domain-runtime.
  honoApp
    .use('*', domainContextMiddleware(config.domainContext))
    .use('*', requestId())
    .use('*', securityHeaders)
    .use('*', dbQueryCountMiddleware())
    .use('*', catalogRequestCacheMiddleware())

  // Per-request trace boundary (the infrastructure observability performance requirement /
  // -TRACING). Mounted early so it spans the full downstream handling, but
  // deliberately INSIDE `dbQueryCountMiddleware` above: it reads
  // `currentDbQueryCount()` after `next()` resolves, and that read is only
  // request-scoped while the query-count box is still open. Zero overhead when
  // neither telemetry signal is armed.
  mountPerformanceMiddleware(honoApp)

  // Retired-host → canonical-path 301 redirect. Mounted EARLY (right after the
  // request-id + security-headers chain, before every route) so it preempts all
  // downstream routing and short-circuits with a path-preserving 301 when the
  // incoming host matches `SOVRIUM_REDIRECT_HOST`. A complete no-op unless BOTH
  // `SOVRIUM_REDIRECT_HOST` and `SOVRIUM_REDIRECT_HOST_TARGET` are set, so it has
  // zero blast radius on every other deployment — see ./middleware/host-redirect.
  honoApp.use('*', hostRedirect)

  // X-Sovrium-Config response header middleware. Carries the SHA-256 hash of
  // the file-loaded config so operators can identify which config a running
  // server was launched with (and detect a hash change after a SIGUSR1
  // reload) from any HTTP response without hitting the admin API. Config is
  // code-only — there is no runtime config-mutation surface and therefore no
  // file-vs-DB drift to report; the header is just the plain hash.
  let currentConfigHash = configHash ?? ''
  if (currentConfigHash) {
    honoApp.use('*', async (c, next) => {
      await next()
      c.header('X-Sovrium-Config', currentConfigHash)
    })
  }

  // Register the setter the SIGUSR1 reload calls to update the hash
  attachConfigHashSetter(honoApp, (hash: string) => {
    currentConfigHash = hash
  })

  // Analytics retention cleanup middleware — purges stale page view records.
  // Runs awaited on page requests to guarantee old data is removed before response.
  const analyticsEnabled = app.analytics !== undefined && app.analytics !== false
  if (analyticsEnabled) {
    const retentionDays =
      typeof app.analytics === 'object' ? app.analytics.retentionDays : undefined

    honoApp.use('*', async (c, next) => {
      await Effect.runPromise(
        provideDomain(
          c,
          purgeOldAnalyticsData(app.name, retentionDays, resolveOperatorTimezone())
        ).pipe(
          Effect.tapCause((cause) =>
            Effect.sync(() => {
              logDebug('[analytics] retention purge failed', { cause: String(cause) })
            })
          ),
          // effect-swallow: see the tap above. This runs awaited on EVERY page
          // request, so it is logged at debug rather than error — and a
          // housekeeping sweep must never be the reason a page fails to render.
          Effect.catch(() => Effect.void)
        )
      )
      return next()
    })
  }

  // Request access log (debug level only, excludes /assets/*)
  // Create base Hono app and chain API routes directly
  // This pattern is required for Hono RPC type inference to work correctly
  // Setup all routes by chaining the setup functions
  //
  // Bootstrap claim route — mounted unconditionally; handler returns 404
  // when not in bootstrap mode. Mounted FIRST so it intercepts before
  // the auth-routes middleware sees it as an admin path.
  const honoWithLogger = honoApp.use('*', requestLogger)
  const honoWithBootstrap = setupBootstrapRoutes(honoWithLogger, app)

  // Built HERE, at the composition root, and threaded into the auth route chain
  // — the same vector `authInstance` travels on.
  //
  // If `auth-routes.ts` called `createEmailHandlers` itself, `sendEmail` and a
  // live nodemailer transport would sit in the import graph of a file that is
  // otherwise a request handler. Constructing it at the root is what lets that
  // file name the factory as a TYPE only and hold no transport.
  const emailHandlers = createEmailHandlers(app?.auth, app?.name)
  // There are no config-mutation REST routes (config-code-only, [internal ref]):
  // config changes ONLY by editing the app config file.

  // Live SEO routes (/sitemap.xml, /robots.txt) are registered BEFORE the
  // public-directory catch-all (inside setupStaticAssets) so the generated
  // routes win over same-named static files, and they sit ahead of the page
  // catch-all so they aren't treated as page paths.
  // `setupStaticAssets` is async (it realpath()s `publicDir` once at mount
  // time for the symlink-escape guard); the await sits inline so the rest of
  // the pipeline stays a single expression. setupPageRoutes wraps the
  // dev-live-reload + static-assets stack, which itself wraps SEO → MCP →
  // auth → openapi → schema/bootstrap.
  //
  // `app.redirects` sits AFTER the static-assets stack and
  // BEFORE the page routes — the one position where a real public-directory file
  // still wins (a rule can never hijack `/install`) while a retired path still
  // answers its redirect instead of the page catch-all's 404.
  //
  // `app.links` takes the same slot, just inside the
  // redirect layer, for the same reason plus one that is MANDATORY rather than
  // stylistic: `setupLanguageRoutes` (inside `setupPageRoutes`) registers
  // `/:lang/*`, which matches `/l/abc`, and its handler renders a 404
  // terminally instead of calling `next()`. Mounted after the page routes,
  // every short link would 404.
  //
  // Every API route is registered by now, and the page routes below match any
  // path (`/:lang/*`, `*`) and render the HTML not-found page. An `/api/*` path
  // no route claimed is a machine request: it answers the one JSON 404 body
  // every API road answers, before a page route can take it.
  const honoWithRoutes = setupPageRoutes(
    answerUnmatchedApiPaths(app)(
      setupRedirectRoutes(
        // The anonymous design-system share reader ([internal ref] A3 Part 2) sits in
        // the SAME slot as `/l/:token` and for the same reason: after the static
        // assets, before `setupPageRoutes`, whose `/:lang/*` route would match
        // `/s/...` and render a terminal 404 rather than calling `next()`.
        // `/oauth/consent` takes the same slot for the same reason. Better Auth
        // redirects the browser here mid-authorization; mounted after the page
        // routes, that redirect would land on `/:lang/*`'s terminal 404.
        setupOauthConsentRoutes(
          setupDesignSystemShareRoutes(
            setupLinkRoutes(
              setupDevReloadRoute(
                await setupStaticAssets(
                  setupSeoRoutes(
                    setupMcpRoutes(
                      setupAuthRoutes(
                        setupAuthMiddleware(
                          setupOpenApiRoutes(
                            createApiRoutes(
                              app,
                              honoWithBootstrap as Hono,
                              authInstance,
                              getSession
                            ),
                            app,
                            authInstance
                          ),
                          app
                        ),
                        app,
                        {
                          authInstance,
                          runtime,
                          emailHandlers,
                          // The admin-invitation store and engine over the same
                          // instance — built here so the invitation use-cases
                          // hold no query module and no engine type.
                          invitations: createInvitationServices(authInstance),
                        }
                      ),
                      app,
                      {
                        domainContext: config.domainContext,
                        authInstance,
                        // The two file-backed facts the A8 config tools publish.
                        // Supplied HERE because this is the one composition root
                        // that may name both `infrastructure-server` and the
                        // presentation tree; a route may not reach the status
                        // file itself.
                        configHash: configHash ?? '',
                        readStatusDocument,
                        // The admin read tools answer against the same host the
                        // admin routes build, which belongs to the admin slug.
                        makeAdminReadHost,
                      }
                    ),
                    app,
                    config.fetchSitemapRecords
                  ),
                  app,
                  config.publicDir,
                  Context.get(config.domainContext, AssetStore).realpaths
                ),
                config.staticRender !== true && isLiveReloadEligible()
              ),
              app
            ),
            app
          ),
          app
        ),
        app
      )
    ),
    // Inject getSession into config for page route handlers.
    //
    // `adminMounts` rides the same vector for the same reason, added in W5c:
    // resolving where the console sits decodes an embedded build artifact
    // (infrastructure), while the two routes that read the answer — the mount's
    // own registration and the URL canonicalizer, which must not rewrite paths
    // inside a mount — are presentation. This is the one place already
    // permitted to hold both. Resolved ONCE here rather than per request, which
    // is also what stops the canonicalizer rebuilding its reserved-prefix list
    // on every request through two `use('*')` handlers.
    { ...config, getSession, adminMounts: adminMountsFor(app) },
    // The console's mount registrar, supplied rather than imported — see
    // `MountRegistrar` in `page-routes.ts`. Its chain POSITION is unchanged;
    // only the import moved, onto the one file already permitted to hold it.
    setupAdminMountRoutes
  )

  // Add error handlers
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
        // Report to the telemetry backend (fire-and-forget, no-op unless SENTRY_DSN
        // is set) WITH request context, BEFORE logError — the reporter's WeakMap
        // then dedups the same error object when the logError-with-cause path
        // forwards it again.
        //
        // Gated on the SAME predicate that path uses, so the two agree instead of
        // relying on the dedup to hide a disagreement. A 4xx that is the caller's
        // own fault — the 400 a validator raises on a truncated body, the shape a
        // public endpoint sees most — is answered correctly below and belongs in
        // the log, not in the operator's paging surface. A 5xx (including
        // `hono/timeout`'s 504) is reported here exactly as before.
        if (isOperatorActionable(error)) {
          void reportException(error, {
            method: c.req.method,
            url: c.req.url,
            headers: Object.fromEntries(c.req.raw.headers.entries()),
          })
        }

        // An `HTTPException` carries its OWN status (and, when the raiser supplied
        // one, its own response). Honour it — this handler REPLACES Hono's default
        // `.onError`, which does exactly that via `if ('getResponse' in err)`.
        // Losing it collapses `hono/timeout`'s `HTTPException(504)` into a
        // hard-coded 500, which is what a production incident looked like.
        const status = error instanceof HTTPException ? error.status : 500
        logError(`[server] ${c.req.method} ${c.req.path} → ${status}`, error)

        // Content negotiation by ROUTE FAMILY, not by `Accept` header: `/api/*` is
        // a machine surface and must always answer with the canonical error
        // envelope every other 4xx/5xx uses, so one client-side decoder covers
        // every failure. Page routes keep the human-facing rendered error page.
        if (isApiPath(c.req.path)) {
          if (status === 404) return c.json(notFoundBody(apiErrorMessage(error, status)), 404)
          return c.json(
            {
              success: false,
              message: apiErrorMessage(error, status),
              code: apiErrorCodeForStatus(status),
            },
            status
          )
        }

        // Non-API: an explicitly-bodied `HTTPException` wins (the raiser chose
        // that response); anything else renders the error page.
        if (error instanceof HTTPException && error.res !== undefined) {
          return error.getResponse()
        }
        return c.html(await renderErrorPage(app), status)
      })
  )
}
