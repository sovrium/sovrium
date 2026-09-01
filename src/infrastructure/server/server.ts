/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- server entry-point coordinates startup, route mounting, SIGUSR1 reload, lifecycle, and degradation phases. Splitting into separate modules has been deferred since each section is tightly coupled to ServerConfig. C-01 added the reload-versioning sidecar read (+26 lines). */

import { readFileSync, rmSync } from 'node:fs'
import { Effect, Config } from 'effect'
import { Hono } from 'hono'
import { websocket } from 'hono/bun'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import { AiService } from '@/application/ports/services/ai-service'
import { purgeOldAnalyticsData } from '@/application/use-cases/analytics/purge-old-data'
import { buildEffectiveRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { appRequiresEmail, isAdminEquivalent } from '@/domain/models/app'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { filterAgentKnowledgeTables } from '@/domain/services/rag/rag-knowledge-access'
import { AiLive } from '@/infrastructure/ai/layer'
import { runSyncAgentUsers } from '@/infrastructure/auth/agent-user-sync'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { rekeyUnreadableJwks } from '@/infrastructure/auth/better-auth/jwks-rekey'
import { seedMcpResourceServerClient } from '@/infrastructure/auth/better-auth/mcp-resource-server'
import { runOrgTeamSeeding } from '@/infrastructure/auth/better-auth/org-team-seeder'
import { runSeedAllConnectionDefinitions } from '@/infrastructure/connections/test-token-seeder'
import { compileCSS } from '@/infrastructure/css/compiler'
import { runAdminSearchIndexPurge } from '@/infrastructure/database/admin-search-index-purge'
import { AiComputeListener } from '@/infrastructure/database/ai-compute-listener'
import {
  runRagKnowledgeStartup,
  stopAiKnowledgeListener,
} from '@/infrastructure/database/ai-knowledge-listener'
import { runAttachmentUrlBackfill } from '@/infrastructure/database/attachment-url-backfill'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { isAiComputeFieldType } from '@/infrastructure/database/generators/ai-field-triggers'
import { runLinkShadowSweep } from '@/infrastructure/database/link-shadow-sweep'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics/analytics-repository-live'
import { countTokensEncryptedWithAnotherKey } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'
import {
  initializeSchema,
  type AuthConfigRequiredForUserFields,
  type SchemaInitializationError,
} from '@/infrastructure/database/schema/schema-initializer'
import { reconcileUserForeignKeys } from '@/infrastructure/database/schema/user-foreign-key-reconciler'
import { runStorageBucketBackfill } from '@/infrastructure/database/storage-bucket-backfill'
import { reconcileTimestamptzColumns } from '@/infrastructure/database/timestamptz-column-reconciler'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { isEmailConfigured } from '@/infrastructure/email/email-config'
import { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import { isIpHashSaltConfigured } from '@/infrastructure/forms/ip-hash'
import { logDebug, logError, logInfo, logWarning } from '@/infrastructure/logging/logger'
import { renderStartupSummary, type StartupPhase } from '@/infrastructure/logging/startup-summary'
import { registerAccountPurgeScheduler } from '@/infrastructure/scheduling/register-account-purge'
import { registerActivityLogRetentionScheduler } from '@/infrastructure/scheduling/register-activity-log-retention'
import {
  disposeCronScheduler,
  registerCronAutomations,
} from '@/infrastructure/scheduling/register-cron-automations'
import { applyBootstrapTokenToSummary } from '@/infrastructure/server/bootstrap-banner'
import {
  computeConfigHash,
  getLockFilePath,
  writeLockFile as writeLockFileToDisk,
} from '@/infrastructure/server/lock-file'
import { hostRedirect } from '@/infrastructure/server/middleware/host-redirect'
import { requestLogger } from '@/infrastructure/server/middleware/request-logger'
import { securityHeaders } from '@/infrastructure/server/middleware/security-headers'
import { registerAgentSchedules } from '@/infrastructure/server/register-agent-schedules'
import { createApiRoutes } from '@/infrastructure/server/route-setup/api-routes'
import {
  setupAuthMiddleware,
  setupAuthRoutes,
} from '@/infrastructure/server/route-setup/auth-routes'
import { setupBootstrapRoutes } from '@/infrastructure/server/route-setup/bootstrap-routes'
import { setupDesignSystemShareRoutes } from '@/infrastructure/server/route-setup/design-system-share-routes'
import { setupDevReloadRoute } from '@/infrastructure/server/route-setup/dev-reload-routes'
import { setupLinkRoutes } from '@/infrastructure/server/route-setup/link-routes'
import { setupMcpRoutes } from '@/infrastructure/server/route-setup/mcp/routes'
import { setupOauthConsentRoutes } from '@/infrastructure/server/route-setup/oauth-consent-routes'
import { setupOpenApiRoutes } from '@/infrastructure/server/route-setup/openapi-routes'
import {
  setupPageRoutes,
  type HonoAppConfig,
} from '@/infrastructure/server/route-setup/page-routes'
import { setupRedirectRoutes } from '@/infrastructure/server/route-setup/redirect-routes'
import { setupSeoRoutes } from '@/infrastructure/server/route-setup/seo-routes'
import { setupStaticAssets } from '@/infrastructure/server/route-setup/static-assets'
import { publishBoundOrigin } from '@/infrastructure/server/server-origin-live'
import {
  collectStoragePhases,
  collectAiListenerPhases,
  collectAdminPhases,
  collectPublicDirPhases,
  collectTelemetryPhases,
  buildStartupPhases,
  databaseStartupLabel,
} from '@/infrastructure/server/startup-degradation-phases'
import { validateEcoEnv } from '@/infrastructure/server/validate-eco-env'
import { validateStoragePublicAccessEnv } from '@/infrastructure/server/validate-storage-public-access-env'
import { validateTransformPresetEnv } from '@/infrastructure/server/validate-transform-preset-env'
import { reportException } from '@/infrastructure/telemetry/error-reporter'
import { createPerformanceMiddleware } from '@/infrastructure/telemetry/performance-middleware'
import { getTelemetryConfig } from '@/infrastructure/telemetry/telemetry-config'
import { shutdownTelemetry } from '@/infrastructure/telemetry/telemetry-sink'
import { getSovriumVersion } from '@/infrastructure/utils/version'
import type { ServerInstance } from '@/application/models/server'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { ApiErrorCode } from '@/domain/models/api/_shared/error'
import type { App } from '@/domain/models/app'
import type { DatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import type { SessionInfo } from '@/domain/types/session-info'
import type {
  DatabaseConnectionError,
  MigrationError,
} from '@/infrastructure/database/drizzle/migrate'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'

/**
 * Server configuration options
 */
export interface ServerConfig {
  readonly app: App
  readonly port?: number
  readonly hostname?: string
  readonly publicDir?: string
  readonly silent?: boolean
  readonly configHash?: string
  readonly configPath?: string
  readonly renderPage: (
    app: App,
    path: string,
    requestContext?: {
      readonly detectedLanguage?: string
      readonly session?: SessionInfo
      readonly cookies?: Readonly<Record<string, string>>
      readonly previewMode?: boolean
      readonly requestQuery?: Readonly<Record<string, string>>
      /** [internal ref]..039: the `/:lang/` URL-prefix locale, when present. */
      readonly urlLanguage?: string
    }
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  /**
   * RSS feed renderer ([internal ref] — [internal ref]).
   *
   * Optional so SSG and legacy callers that don't yet pass through the
   * RSS pipeline keep working — the route handler 404s when undefined.
   */
  readonly renderRssFeed?: (app: App, baseUrl: string) => Promise<string | undefined>
  /** Plaintext bootstrap token surfaced in the startup banner exactly once when defined. */
  readonly bootstrapToken?: string
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
 * Builds a getSession callback from an auth instance for page access control
 */
function buildGetSession(
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app: Readonly<App>
): (headers: Headers) => Promise<SessionInfo | undefined> {
  return async (headers) => {
    try {
      const session = await authInstance.api.getSession({ headers })
      if (!session) return undefined
      // Admin plugin adds `role` to user at runtime (not in base type)
      const user = session.user as { id: string; email?: string; name?: string; role?: string }
      const role = user.role ?? 'member'
      // Better Auth admin plugin grants global, unrestricted access to the
      // app's admin-equivalent role. The Z-1 `$currentUser.isUnrestricted`
      // flag mirrors that — Z-1.
      // `isAdminEquivalent` resolves the highest-`level` custom role (e.g.
      // cloud `operator`, partner `engineer`) and still honors built-in
      // `admin`, so custom-role apps no longer bounce their superuser to
      // `/no-access` (WI-5).
      const isUnrestricted = isAdminEquivalent(role, app)
      // Sovrium group memberships — drives group-based page access.
      const groups = await getUserGroups(user.id)
      // Effective roles = global Better Auth role + `group:<name>` overlay for
      // every group the user belongs to. Stamped at hydration time so every
      // downstream consumer (`checkPageAccess`, `isSharedViewAccessDenied`,
      // …) sees the same set the table-level row-level guard uses — closing
      // the single-role-vs-effective-roles asymmetry called out in Phase 8.
      const effectiveRoles = buildEffectiveRoles(role, groups)
      return {
        userId: user.id,
        role,
        email: user.email,
        name: user.name,
        isUnrestricted,
        groups,
        effectiveRoles,
      }
    } catch {
      return undefined
    }
  }
}

/**
 * Mount the performance-transaction timing middleware when sampling is armed
 * (`SENTRY_DSN` + `SENTRY_TRACES_SAMPLE_RATE` in `(0,1]`). No-op otherwise.
 */
function mountPerformanceMiddleware(honoApp: Readonly<Hono>): void {
  const telemetryConfig = getTelemetryConfig()
  if (telemetryConfig.performance !== undefined) {
    // eslint-disable-next-line functional/no-expression-statements -- register Hono middleware
    honoApp.use('*', createPerformanceMiddleware(telemetryConfig.performance.sampleRate))
  }
}

export async function createHonoApp(
  config: HonoAppConfig & { readonly configHash?: string }
): Promise<Readonly<Hono>> {
  const { app, renderNotFoundPage, renderErrorPage, configHash } = config

  // Create auth instance once — shared between auth routes and page session extraction.
  // `app.connections` is forwarded to the user-create databaseHook so the
  // test-mode token seeder (no-op in production) can auto-populate
  // `system.connection_tokens` for newly registered users without
  // requiring each spec to drive the real OAuth round-trip.
  const authInstance = app.auth ? createAuthInstance(app.auth, app.connections, app) : undefined
  const getSession = authInstance ? buildGetSession(authInstance, app) : undefined

  const honoApp = new Hono()

  // Request correlation ID — mounted first so every downstream middleware,
  // route handler, and error handler can read a single stable `c.get('requestId')`
  // (and the response carries an `X-Request-Id` header); replaces ad-hoc
  // per-handler `crypto.randomUUID()` minting. Chained with the security
  // headers (HSTS, report-only CSP, Permissions-Policy, X-Frame-Options,
  // nosniff, …) so every response carries them — config + rationale live in
  // ./middleware/security-headers.
  // eslint-disable-next-line functional/no-expression-statements
  honoApp.use('*', requestId()).use('*', securityHeaders)

  // Performance-transaction timing middleware.
  // Mounted early (right after security headers) so it times the full downstream
  // handling, and ONLY when performance sampling is armed — zero overhead otherwise.
  mountPerformanceMiddleware(honoApp)

  // Retired-host → canonical-path 301 redirect. Mounted EARLY (right after the
  // request-id + security-headers chain, before every route) so it preempts all
  // downstream routing and short-circuits with a path-preserving 301 when the
  // incoming host matches `SOVRIUM_REDIRECT_HOST`. A complete no-op unless BOTH
  // `SOVRIUM_REDIRECT_HOST` and `SOVRIUM_REDIRECT_HOST_TARGET` are set, so it has
  // zero blast radius on every other deployment — see ./middleware/host-redirect.
  // eslint-disable-next-line functional/no-expression-statements
  honoApp.use('*', hostRedirect)

  // X-Sovrium-Config response header middleware. Carries the SHA-256 hash of
  // the file-loaded config so operators can identify which config a running
  // server was launched with (and detect a hash change after a SIGUSR1
  // reload) from any HTTP response without hitting the admin API. Config is
  // code-only — there is no runtime config-mutation surface and therefore no
  // file-vs-DB drift to report; the header is just the plain hash.
  // eslint-disable-next-line functional/no-let
  let currentConfigHash = configHash ?? ''
  if (currentConfigHash) {
    // eslint-disable-next-line functional/no-expression-statements
    honoApp.use('*', async (c, next) => {
      // eslint-disable-next-line functional/no-expression-statements
      await next()
      c.header('X-Sovrium-Config', currentConfigHash)
    })
  }

  // Store setter on honoApp for SIGUSR1 reload to update the hash
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, @typescript-eslint/no-explicit-any
  ;(honoApp as any).__setConfigHash = (hash: string) => {
    // eslint-disable-next-line functional/no-expression-statements
    currentConfigHash = hash
  }

  // Analytics retention cleanup middleware — purges stale page view records.
  // Runs awaited on page requests to guarantee old data is removed before response.
  const analyticsEnabled = app.analytics !== undefined && app.analytics !== false
  if (analyticsEnabled) {
    const retentionDays =
      typeof app.analytics === 'object' ? app.analytics.retentionDays : undefined

    honoApp.use('*', async (_c, next) => {
      await Effect.runPromise(
        purgeOldAnalyticsData(app.name, retentionDays).pipe(
          Effect.provide(AnalyticsRepositoryLive),
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
  // Config-mutation REST routes (`/api/admin/schema/*` draft→publish, versions,
  // drift, preview) were retired with the config-code-only reshape:
  // config changes ONLY by editing the app config file.

  // Live SEO routes (/sitemap.xml, /robots.txt) are registered BEFORE the
  // public-directory catch-all (inside setupStaticAssets) so the generated
  // routes win over same-named static files, and they sit ahead of the page
  // catch-all so they aren't treated as page paths ([internal ref]..015).
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
  const honoWithRoutes = setupPageRoutes(
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
                        setupOpenApiRoutes(createApiRoutes(app, honoWithBootstrap as Hono), app),
                        app
                      ),
                      app,
                      authInstance
                    ),
                    app,
                    authInstance
                  ),
                  app
                ),
                app,
                config.publicDir
              )
            ),
            app
          ),
          app
        ),
        app
      ),
      app
    ),
    // Inject getSession into config for page route handlers.
    { ...config, getSession }
  )

  // Add error handlers
  return honoWithRoutes
    .notFound(async (c) => c.html(await renderNotFoundPage(app), 404))
    .onError(async (error, c) => {
      // Report to the telemetry backend (fire-and-forget, no-op unless SENTRY_DSN
      // is set) WITH request context, BEFORE logError — the reporter's WeakMap
      // then dedups the same error object when the logError-with-cause path
      // forwards it again.
      // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget crash report
      void reportException(error, {
        method: c.req.method,
        url: c.req.url,
        headers: Object.fromEntries(c.req.raw.headers.entries()),
      })

      // An `HTTPException` carries its OWN status (and, when the raiser supplied
      // one, its own response). Honour it — this handler REPLACES Hono's default
      // `.onError`, which does exactly that via `if ('getResponse' in err)`.
      // Losing it is what collapsed `hono/timeout`'s `HTTPException(504)` into a
      // hard-coded 500 during the 2026-07-25 incident.
      const status = error instanceof HTTPException ? error.status : 500
      logError(`[SERVER] ${c.req.method} ${c.req.path} → ${status}`, error)

      // Content negotiation by ROUTE FAMILY, not by `Accept` header: `/api/*` is
      // a machine surface and must always answer with the canonical error
      // envelope every other 4xx/5xx uses, so one client-side decoder covers
      // every failure. Page routes keep the human-facing rendered error page.
      if (isApiPath(c.req.path)) {
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
}

/** Whether a request path belongs to the machine-facing `/api/*` surface. */
const isApiPath = (path: string): boolean => path === '/api' || path.startsWith('/api/')

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

const apiErrorCodeForStatus = (status: number): ApiErrorCode =>
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
const apiErrorMessage = (error: unknown, status: number): string => {
  if (error instanceof HTTPException && error.message.length > 0) return error.message
  return status === 500 ? 'Internal server error' : 'Request failed'
}

/**
 * Parse a port string into a valid port number, or return undefined
 */
const parsePort = (value: string | undefined): number | undefined => {
  if (!value) return undefined
  const parsed = parseInt(value, 10)
  return !isNaN(parsed) && parsed >= 0 && parsed <= 65_535 ? parsed : undefined
}

/**
 * How long in-flight requests get to finish before open connections are cut.
 *
 * `Bun.serve().stop()` without an argument waits for every connection to close
 * ON ITS OWN, and the server holds long-lived ones by design — SSE streams and
 * the WebSocket heartbeat both re-arm an interval forever. Waiting for those is
 * waiting for a client to navigate away, which is why an unbounded `stop()`
 * looked like "the server ignores SIGTERM". So: a short drain for real
 * requests, then a forced close.
 */
const SHUTDOWN_DRAIN_MS = 150

/**
 * Create server stop effect. Also tears down the cron scheduler so timer
 * cleanup is belt-and-braces.
 *
 * Order matters: the socket goes first so no new work arrives while the
 * listeners and the telemetry exporter are torn down, and telemetry stays last
 * so anything logged during teardown still has somewhere to go.
 */
const createStopEffect = (
  server: ReturnType<typeof Bun.serve>,
  aiComputeListener?: Readonly<AiComputeListener>
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    logDebug('[server] stopping...')
    disposeCronScheduler() // belt-and-braces: child-process kill already clears timers
    // Drain, then force. The race resolves on whichever comes first; the
    // second call closes whatever is left (`closeActiveConnections`).
    yield* Effect.promise(() => Promise.race([server.stop(), Bun.sleep(SHUTDOWN_DRAIN_MS)]))
    yield* Effect.promise(() => server.stop(true))
    if (aiComputeListener) yield* Effect.promise(() => aiComputeListener.stop().catch(() => {}))
    // Tear down the RAG knowledge-change listener.
    yield* Effect.promise(() => stopAiKnowledgeListener().catch(() => {}))
    // Flush + close the OTLP log-export runtime (no-op unless log export is on).
    yield* Effect.promise(() => shutdownTelemetry().catch(() => {}))
    logInfo('[server] stopped')
  })

/**
 * Get database URL from environment configuration
 */
const getDatabaseUrl = (): Effect.Effect<string, never> =>
  Config.string('DATABASE_URL').pipe(
    Config.withDefault(''),
    Effect.orElseSucceed(() => '')
  )

/**
 * Build the `Bun.serve` options for the Hono app.
 *
 * The `websocket` handler powers the Records API real-time WebSocket
 * transport: the `/api/tables/:slug/subscribe` route handler upgrades a
 * `Upgrade: websocket` request via Hono's `upgradeWebSocket` helper (which
 * calls `server.upgrade()` under the hood) and Bun routes the upgraded
 * connection to the matched `websocket` handler imported from `hono/bun`.
 *
 * Bun passes the live `server` as the second `fetch` argument; we forward it
 * to Hono as the `env` so `upgradeWebSocket` (via `getBunServer(c)`) can
 * reach `server.upgrade()`.
 */
const buildBunServeOptions = (honoApp: Readonly<Hono>, port: number, hostname: string) => ({
  port,
  hostname,
  fetch: (request: Request, server: unknown): Response | Promise<Response> =>
    honoApp.fetch(request, { server }),
  websocket,
})

/**
 * Start Bun HTTP server
 */
const startBunServer = (
  honoApp: Readonly<Hono>,
  port: number,
  hostname: string
): Effect.Effect<ReturnType<typeof Bun.serve>, ServerCreationError, never> =>
  Effect.try({
    try: () => Bun.serve(buildBunServeOptions(honoApp, port, hostname)),
    catch: (error) => new ServerCreationError(error),
  }).pipe(
    // Retry on EADDRINUSE with port 0 (auto-select) as fallback
    Effect.catchIf(
      (e) => {
        const { cause } = e as ServerCreationError
        return (
          typeof cause === 'object' &&
          cause !== null &&
          'code' in cause &&
          (cause as { code: string }).code === 'EADDRINUSE'
        )
      },
      () =>
        Effect.try({
          try: () => {
            logWarning(`[SERVER] Port ${port} in use; using an OS-assigned port (see URL below).`)
            return Bun.serve(buildBunServeOptions(honoApp, 0, hostname))
          },
          catch: (error) => new ServerCreationError(error),
        })
    )
  )

/**
 * Read Sovrium's build version (build-time define, package.json fallback).
 */
const getPackageVersion = (): Effect.Effect<string, never> =>
  Effect.promise(() => getSovriumVersion())

/**
 * Determine whether an AI compute listener should be started for the given
 * app schema and database configuration. Returns a prepared (but unstarted)
 * listener, or `undefined` when the preconditions aren't met.
 *
 * Env-var presence is no longer probed here — that responsibility moved to
 * `AiServiceLive` as part of the Spec 4 listener migration (P0-2). We ask
 * the materialised `AiService` whether it found credentials and skip the
 * listener entirely when it didn't, mirroring the pre-migration behaviour
 * (silent skip when `AI_BASE_URL` / `AI_API_KEY` are unset).
 */
const resolveAiComputeListener = (
  app: App,
  databaseUrl: string
): Effect.Effect<Readonly<AiComputeListener> | undefined, never> =>
  Effect.gen(function* () {
    if (!databaseUrl) return undefined
    // The AI compute listener needs PL/pgSQL triggers + `pg_notify` — skip it
    // on SQLite (the feature degrades; see `collectAiListenerPhases`).
    if (isSqliteRuntime()) return undefined
    const tables = app.tables ?? []
    const hasAiComputeField = tables.some((table) =>
      table.fields.some((field) => isAiComputeFieldType(field.type))
    )
    if (!hasAiComputeField) return undefined

    const aiService = yield* AiService
    if (!aiService.isConfigured()) return undefined

    return new AiComputeListener(databaseUrl, app.name)
  }).pipe(Effect.provide(AiLive))

/**
 * Start the AI compute NOTIFY listener when the app schema has any AI-compute
 * fields (`ai-categorize`, `ai-summary`, or `ai-translate`) and AI provider
 * env is configured.
 *
 * Failure to start is non-fatal — the synchronous PL/pgSQL trigger still
 * computes values. Callers receive `undefined` in that case so they can skip
 * stopping.
 */
const startAiComputeListenerIfNeeded = (
  app: App,
  databaseUrl: string
): Effect.Effect<Readonly<AiComputeListener> | undefined, never> =>
  Effect.gen(function* () {
    const listener = yield* resolveAiComputeListener(app, databaseUrl)
    if (!listener) return undefined

    // Silent — synchronous trigger still computes values even without listener.
    return yield* Effect.promise(() =>
      listener
        .start()
        .then(() => listener)
        .catch(() => undefined)
    )
  })

/**
 * Run the database startup chain (migrations → schema → best-effort post-schema
 * steps).
 *
 * SQLite is a real, zero-config database — migrations and schema init **always**
 * run, regardless of whether `DATABASE_URL` is set. When the resolved dialect is
 * `postgres` the flow is behaviourally identical to the historical Postgres
 * path. `runRagKnowledgeStartup` is still keyed off `databaseUrl` (the RAG
 * pipeline is Postgres-only and self-skips with an empty string on SQLite).
 */
/**
 * Filter every agent's `knowledge.tables[]` down to the tables their declared
 * role is allowed to read. Returns the agent list in the
 * shape `runRagKnowledgeStartup` consumes, with admin-only tables dropped for
 * lower-privilege agents.
 */
const filterRagKnowledgeByRole = (app: App) =>
  (app.agents ?? []).map((agent) => filterAgentKnowledgeTables(agent, app.tables ?? []))

const runDatabaseStartup = (
  app: App,
  dialectConfig: DatabaseDialectConfig
): Effect.Effect<
  readonly StartupPhase[],
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | DatabaseConnectionError
  | MigrationError
> => {
  return runMigrations(dialectConfig).pipe(
    Effect.flatMap(() => initializeSchema(app)),
    // Unify declared `created-at` / `updated-at` / `deleted-at` columns on
    // TIMESTAMPTZ, behind an operator opt-in. NOT best-effort: when the operator
    // has opted in and the `TimeZone` preflight refuses, that abort IS the
    // feature. With the gate off (the default) it emits no DDL and only warns.
    //
    // It sits HERE and not inside `initializeSchema` for the same reason as the
    // attachment-URL repair below: that path is guarded by a checksum computed
    // from `app.tables` alone, so an operator upgrading the binary without
    // editing their config never reaches it — exactly the install whose columns
    // drifted.
    Effect.flatMap(() => reconcileTimestamptzColumns(app)),
    // Put `ON DELETE SET NULL` on every `type: 'user'` foreign key that predates
    // it, so an account assigned on somebody else's record can be erased at all.
    // Unlike the timestamptz step above this one is NOT gated: on Postgres the
    // swap is catalog-only, and on SQLite — the zero-config default — a gate
    // defaulting to off would leave most self-hosted installs unerasable.
    //
    // Same placement and same reason as its two neighbours: the checksum
    // guarding `executeMigrationSteps` is computed from `app.tables` alone, so an
    // operator upgrading the binary without editing their config never reaches
    // it — exactly the install still carrying the unerasable key.
    Effect.flatMap(() => reconcileUserForeignKeys(app)),
    // Best-effort post-schema seeders (each never blocks startup): seed
    // system.connections, sync agent users, seed orgs/teams. These stay
    // PRE-bind because auth and agent routes may consult their rows on the
    // very first request. The two heavyweight best-effort steps — the
    // attachment-URL backfill and RAG embedding startup — moved to
    // `runDeferredStartupMaintenance`, which `createServer` runs AFTER the
    // listener binds and BEFORE it announces readiness: both can take
    // seconds-to-minutes on large datasets, and the port is open throughout.
    //
    // Drop the derived admin global-search index so the next lazy rebuild
    // repopulates it under the CURRENT indexing rules ([internal ref] R3). Narrowing
    // the indexer alone is prospective-only: `rebuildIndex` never deletes, so
    // rows it stops emitting — soft-deleted submissions, rows past the per-source
    // LIMIT, hard-deleted ones — would keep their old body forever.
    //
    // ORDERING IS LOAD-BEARING ON SQLITE and must stay after `runMigrations`,
    // which is where the FTS5 vtab + its content-sync triggers are created: the
    // SQLite index is external-content, so a content-row DELETE without the
    // `…_ad` trigger in place leaves the tokens in the inverted index. Invisible
    // on Postgres. It also has to stay PRE-BIND — after the listener opens, a
    // search request could rebuild and answer from residue first.
    Effect.flatMap(() => Effect.promise(() => runAdminSearchIndexPurge())),
    Effect.flatMap(() =>
      Effect.promise(() => runSeedAllConnectionDefinitions({ connections: app.connections }))
    ),
    Effect.flatMap(() =>
      Effect.promise(() => runSyncAgentUsers({ agents: app.agents, hasAuth: !!app.auth }))
    ),
    Effect.flatMap(() => Effect.promise(() => runOrgTeamSeeding(app))), // org + team seeding
    // Seed the MCP resource server's own confidential OAuth client and link it
    // to the MCP protected resource. It only ever authenticates the server to
    // its own introspection endpoint, so it is derived from the root secret
    // rather than configured, and it is skipped entirely unless both auth and
    // MCP are on. PRE-bind, because the very first MCP request introspects.
    //
    // The gate reads `MCP_ENABLED` raw rather than decoding the MCP env schema.
    // Decoding here would raise the schema's own error ahead of the dedicated
    // MCP validation step, replacing its actionable message
    // ("MCP env validation failed: ...") with a bare decode failure — which is
    // what an operator would then have to debug.
    Effect.flatMap(() =>
      Effect.promise(() =>
        seedMcpResourceServerClient({
          hasAuth: !!app.auth,
          mcpEnabled: process.env['MCP_ENABLED'] === 'true',
        }).catch(() => undefined)
      )
    ),
    // Two surveys of key material the current secrets may no longer be able to
    // read. Both run AFTER migrations and schema init, so the tables they touch
    // are guaranteed to exist, and both run at boot rather than on first use: an
    // operator whose key changed needs to hear it once, in the place they are
    // already looking, not one failed request at a time.
    //
    // They resolve opposite ways on purpose. Connection tokens are user data, so
    // the survey counts and warns and changes nothing. JWKS rows are derived key
    // material, so they are regenerated — see `rekeyUnreadableJwks`.
    Effect.flatMap(() =>
      Effect.promise(async () => ({
        foreignKeyIdCount: await countTokensEncryptedWithAnotherKey(),
        rekeyedJwksCount: await rekeyUnreadableJwks(),
      }))
    ),
    Effect.map(({ foreignKeyIdCount, rekeyedJwksCount }): readonly StartupPhase[] => [
      ...foreignKeyIdWarningPhases(foreignKeyIdCount),
      ...jwksRekeyWarningPhases(rekeyedJwksCount),
      { label: databaseStartupLabel(dialectConfig), type: 'success' as const },
    ])
  )
}

/**
 * Deferred best-effort startup maintenance, run by `createServer` AFTER the
 * listener binds but BEFORE the startup banner announces readiness:
 *
 * - Attachment-URL backfill: repairs `default`-bound attachment URLs
 *   accumulated before an upgrade. Table scans — seconds on large datasets.
 * - RAG embedding startup ([internal ref] filtering preserved): embeds
 *   agent knowledge tables and installs change listeners. Network-bound
 *   against the AI provider — the slowest boot step by far when agents exist.
 *
 * Both remain best-effort — a failure here is logged and never fails the boot
 * — but they are AWAITED rather than forked. Moving them off the boot path
 * entirely was tried and reverted: the startup banner then announced a
 * readiness the process had not reached, and a caller that boots and
 * immediately reads a backfilled attachment URL or queries embedded knowledge
 * observed a half-finished boot. Keeping them here still recovers most of the
 * win, because the listener is already bound when they run.
 */
const runDeferredStartupMaintenance = (app: App): Effect.Effect<void, never> => {
  const dialectConfig = parseDatabaseDialectConfig()
  const ragDatabaseUrl = dialectConfig.dialect === 'postgres' ? dialectConfig.databaseUrl : ''
  return Effect.promise(() => runAttachmentUrlBackfill(app)).pipe(
    // AFTER the URL repair: that pass rewrites the stored `url` onto the bucket
    // the column declares, and this one reads those URLs to attribute objects.
    // Running it first would attribute them to the stale bucket.
    Effect.flatMap(() => Effect.promise(() => runStorageBucketBackfill(app))),
    Effect.flatMap(() =>
      Effect.promise(() => runRagKnowledgeStartup(filterRagKnowledgeByRole(app), ragDatabaseUrl))
    ),
    // Reconcile runtime-minted links against the slugs `app.links[]` now
    // declares. Deferred rather than a migration step because the checksum fast
    // path skips migrations entirely, which would mean skipping the sweep on
    // exactly the boot where the config changed.
    Effect.flatMap(() => Effect.promise(() => runLinkShadowSweep(app))),
    Effect.asVoid,
    Effect.catchCause((cause) =>
      Effect.sync(() => logError('[server] deferred startup maintenance failed', cause))
    )
  )
}

/**
 * The boot ⚠ for signing keys that were regenerated because the auth secret
 * changed.
 *
 * Regenerating is not free — every JWT already issued against the old key stops
 * verifying — so it is never done quietly. The alternative was worse: without
 * this, a changed auth secret leaves every signing request answering 500 with a
 * cause visible only in the server log..
 */
const jwksRekeyWarningPhases = (count: number): readonly StartupPhase[] =>
  count > 0
    ? [
        {
          label:
            `${count} JWT signing keys could not be read with the current auth secret ` +
            'and were regenerated — previously issued tokens are no longer valid',
          type: 'warning' as const,
        },
      ]
    : []

/**
 * The boot ⚠ for stored tokens written under a different encryption key.
 *
 * Warn, never refuse: the affected users have to re-authorize, but taking a whole
 * deployment down over a subset of them would be a far larger outage than the one
 * being reported. Silent is the only genuinely wrong answer — see
 * [internal ref].
 */
const foreignKeyIdWarningPhases = (count: number): readonly StartupPhase[] =>
  count > 0
    ? [
        {
          // The noun stays plural at every count. It reads slightly oddly at
          // one, and that is the deliberate trade: `stored connection tokens` is
          // the phrase both [internal ref] and its regression sibling
          // match on, and a count-dependent noun would make the warning
          // undetectable exactly when a single user is affected.
          label:
            `${count} stored connection tokens encrypted with a different key ` +
            '— affected users must reconnect',
          type: 'warning' as const,
        },
      ]
    : []

/**
 * Collect startup phases from infrastructure initialization
 */
const collectInfraPhases = (
  app: App
): Effect.Effect<
  {
    readonly phases: readonly StartupPhase[]
    readonly cssSizeKB: number
    readonly cssLabel: string
    readonly aiComputeListener: Readonly<AiComputeListener> | undefined
  },
  CSSCompilationError | AuthConfigRequiredForUserFields | SchemaInitializationError | Error
> =>
  Effect.gen(function* () {
    // Database phase. SQLite is a real, zero-config database — the historical
    // "DATABASE_URL not set → skip database" branch is gone. The dialect
    // resolver (`parseDatabaseDialectConfig`) picks PostgreSQL when
    // `DATABASE_URL` is set and SQLite (`./.sovrium/database.db` by default) otherwise;
    // `runDatabaseStartup` always runs migrations → schema → seeds.
    const databaseUrl = yield* getDatabaseUrl()
    const dialectConfig = parseDatabaseDialectConfig()
    const databasePhases: readonly StartupPhase[] = yield* runDatabaseStartup(app, dialectConfig)

    // Admin display phase — emitted right after the database phase so the
    // operator sees the admin email and the data location side-by-side. See
    // `collectAdminPhases` for the three-branch contract (silent on auth-less
    // apps, silent on fresh boots where the bootstrap-token banner is the
    // source of truth, ✓ when an admin exists, ⚠ when users exist but no
    // admin does). [internal ref].
    const adminPhases = yield* Effect.promise(() => collectAdminPhases(app))

    // SMTP check — only warn when the app declares an email-sending capability
    // (emailAndPassword/magicLink auth, or an email automation action) AND
    // SMTP is unconfigured. When unconfigured,
    // outgoing email is disabled (logged, not sent) rather than routed to a
    // local fallback transport.
    const smtpPhases: readonly StartupPhase[] =
      appRequiresEmail(app) && !isEmailConfigured()
        ? [
            {
              label: 'Email sending disabled — SMTP not configured (set SMTP_HOST to enable)',
              type: 'warning' as const,
            },
          ]
        : []

    // FORM_IP_HASH_SALT check — only warn when the app declares forms[] AND
    // the env var is unset. [internal ref] + S5: hashing still works (a
    // session-scoped fallback salt is generated) but hashes are not
    // comparable across process restarts. Operators who want stable hashes
    // must set FORM_IP_HASH_SALT to a long random string.
    const formSaltPhases: readonly StartupPhase[] =
      (app.forms?.length ?? 0) > 0 && !isIpHashSaltConfigured()
        ? [
            {
              label:
                'FORM_IP_HASH_SALT not set — submitter IP hashes will reset on every restart (set a long random value)',
              type: 'warning' as const,
            },
          ]
        : []

    // Storage check — see collectStoragePhases for the contract.
    const storagePhases = collectStoragePhases()

    // Telemetry destinations — a
    // `✓ Telemetry:` line per active signal, host-only, silent when off.
    const telemetryPhases = collectTelemetryPhases()

    // AI-listener degradation notice — see collectAiListenerPhases.
    const aiListenerPhases = collectAiListenerPhases(app)

    // CSS phase
    const cssResult = yield* compileCSS(app)
    const cssSizeKB = Math.round(cssResult.css.length / 1024)
    const cssLabel = cssResult.precompiled
      ? `CSS loaded from file (${cssSizeKB} KB)`
      : `CSS compiled (${cssSizeKB} KB)`

    // Start AI compute listener if the schema defines ai-categorize fields.
    // Failure to start is non-fatal — the synchronous trigger still computes values.
    const aiComputeListener = yield* startAiComputeListenerIfNeeded(app, databaseUrl)

    return {
      phases: [
        ...databasePhases,
        ...adminPhases,
        ...smtpPhases,
        ...formSaltPhases,
        ...storagePhases,
        ...telemetryPhases,
        ...aiListenerPhases,
      ],
      cssSizeKB,
      cssLabel,
      aiComputeListener,
    }
  })

/**
 * Write lock file for server management (stop/restart/duplicate detection)
 * Must be written before startup summary so the lock file exists when
 * external tools detect the server URL in stdout.
 *
 * Includes configHash and configPath for reload/restart support.
 */
const writeLockFile = (
  port: number | undefined,
  configHash: string,
  configPath: string
): Effect.Effect<void, never> =>
  Effect.tryPromise(() =>
    writeLockFileToDisk({ pid: process.pid, port: port ?? 0, configHash, configPath })
  ).pipe(Effect.ignore)

/**
 * Synchronous lock file cleanup — removes the lock file only if PID matches.
 * Must be at module scope for consistent-function-scoping lint rule.
 */
const cleanupLockFileSync = (): void => {
  try {
    const lockPath = getLockFilePath()
    const raw = readFileSync(lockPath, 'utf-8')
    const data = JSON.parse(raw) as { pid: number }
    if (data.pid === process.pid) {
      rmSync(lockPath, { force: true })
    }
  } catch {
    // Ignore errors during cleanup (file may not exist)
  }
}

/**
 * Register signal handlers to remove lock file on graceful shutdown
 * and handle SIGUSR1 for config reload
 */
const registerLockFileCleanup = (honoApp: Readonly<Hono>, configPath: string): void => {
  // eslint-disable-next-line functional/no-expression-statements
  process.on('SIGTERM', cleanupLockFileSync)
  // eslint-disable-next-line functional/no-expression-statements
  process.on('SIGINT', cleanupLockFileSync)

  // SIGUSR1 handler: re-read config and update the X-Sovrium-Config header hash.
  // Use the SYNCHRONOUS readFileSync so the setter runs atomically inside the
  // signal-handler tick — guarantees the new hash is observable to the next
  // HTTP request without an awaited microtask gap ([internal ref] was flaky
  // under load when the async readFile yielded back to the event loop and a
  // concurrent fetch was serviced with the still-old closure value).
  //
  // Config is code-only: the reload's sole effect is refreshing the
  // X-Sovrium-Config header hash from the file on disk. There is no version
  // ledger to append to.
  // eslint-disable-next-line functional/no-expression-statements
  process.on('SIGUSR1', () => {
    if (!configPath) return
    try {
      const content = readFileSync(configPath, 'utf-8')
      const newHash = computeConfigHash(content)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setter = (honoApp as any).__setConfigHash as ((hash: string) => void) | undefined
      if (setter) setter(newHash)
    } catch {
      // Ignore errors during reload (header refresh is best-effort).
    }
  })
}

/**
 * Render startup summary with version, phases, and server URL.
 *
 * When `bootstrapToken` is defined, `applyBootstrapTokenToSummary` prepends a
 * `⚠ No admin user …` warning phase and attaches a `BootstrapTokenBanner` so
 * the renderer emits a second `→` footer line with the plaintext. The
 * plaintext is shown EXACTLY ONCE and is never routed through the persistent
 * structured logger.
 */
const renderStartup = (
  phases: readonly StartupPhase[],
  url: string,
  durationMs: number,
  bootstrapToken?: string
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const version = yield* getPackageVersion()
    const augmented = applyBootstrapTokenToSummary(phases, bootstrapToken)
    yield* renderStartupSummary({
      version,
      phases: augmented.phases,
      url,
      durationMs,
      ...(augmented.bootstrapToken ? { bootstrapToken: augmented.bootstrapToken } : {}),
    })
  })

/** Combine infrastructure phases + the static-asset directory phase. */
const collectAllPhases = (config: ServerConfig) =>
  Effect.gen(function* () {
    const r = yield* collectInfraPhases(config.app)
    const pd = yield* Effect.promise(() => collectPublicDirPhases(config.publicDir))
    return { ...r, infraPhases: [...r.phases, ...pd] }
  })

/**
 * Build the Hono application from a ServerConfig. Pure construction — no
 * network binding. Async because `createHonoApp` realpath()s the static-assets
 * root once at mount time (symlink-escape hardening — see setupPublicDirRoute).
 */
const buildHonoAppFromConfig = (config: ServerConfig): Promise<Readonly<Hono>> =>
  createHonoApp({
    app: config.app,
    publicDir: config.publicDir,
    configHash: config.configHash ?? '',
    renderPage: config.renderPage,
    renderNotFoundPage: config.renderNotFoundPage,
    renderErrorPage: config.renderErrorPage,
    ...(config.renderRssFeed !== undefined ? { renderRssFeed: config.renderRssFeed } : {}),
  })

/**
 * Creates and starts a Bun server with Hono
 *
 * Collects startup phases and renders a clean summary at the end.
 *
 * @param config - Server configuration with app data and optional port/hostname
 * @returns Effect that yields ServerInstance or ServerCreationError
 */
// @knip-ignore - Used via dynamic import in StartServer.ts
export const createServer = (
  config: ServerConfig
): Effect.Effect<
  ServerInstance,
  | ServerCreationError
  | CSSCompilationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | TransformPresetError
  | Error
> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    // Boot-time operator-environment validation, before anything is built or
    // bound. All three refuse the boot on a malformed value rather than letting
    // it surface later on whichever request first touches that lever.
    yield* Effect.all([validateTransformPresetEnv, validateStoragePublicAccessEnv, validateEcoEnv])
    const port = config.port ?? parsePort(Bun.env.PORT) ?? 3000
    const hostname = config.hostname ?? (Bun.env.HOSTNAME || 'localhost')
    const { configHash = '', configPath = '' } = config

    // Initialize infrastructure and collect phases (incl. the static-asset
    // directory line via collectPublicDirPhases, silent on the silent-skip
    // mount path).
    const { infraPhases, cssLabel, aiComputeListener } = yield* collectAllPhases(config)

    // Create Hono app and start server
    const honoApp = yield* Effect.promise(() => buildHonoAppFromConfig(config))
    const server = yield* startBunServer(honoApp, port, hostname)
    const url = `http://${hostname}:${server.port}`

    // Publish the origin the socket ACTUALLY bound to, before any armed-up
    // scheduler can mint a URL. `server.port` is not `port`: the bind retries
    // on EADDRINUSE with an OS-assigned port, and the E2E harness asks for
    // `PORT=0` on purpose — so `PORT` is the request and this is the result.
    // A background program has no request to read a `Host` header from, so
    // this is the only place it can learn where it lives.

    publishBoundOrigin(url)

    // Post-bind arm-ups: cron-triggered automations, scheduled agents, and the
    // GDPR Art. 17 erasure sweep (hourly; without it, scheduled account
    // erasures would never complete in production — see
    // register-account-purge.ts). Agent schedules were decoded and echoed back
    // for as long as agents have shipped but never armed; without this line
    // `agent.schedule.cron` is a promise the binary does not keep — see
    // register-agent-schedules.ts.
    yield* Effect.all([
      registerCronAutomations(config.app, process.env),
      registerAgentSchedules(config.app),
      registerAccountPurgeScheduler(config.app),
      registerActivityLogRetentionScheduler,
    ])

    // AWAITED, not forked. The port is already bound above, so a health check
    // or load balancer sees the process live while this runs — that is the
    // whole boot win, and it is kept. What must NOT move ahead of it is the
    // startup banner: the `listening on` line is the LAST line of boot and is
    // exactly what operators and `waitForServerPort`
    // treat as "boot complete". Forking this made the banner print while the
    // attachment-URL backfill and RAG embedding were still running, so a
    // caller that boots a server and immediately asserts on backfilled URLs or
    // embedded knowledge raced a half-finished boot. Announcing readiness
    // before the work that readiness implies is a correctness bug, and
    // correctness outranks the extra seconds.
    yield* runDeferredStartupMaintenance(config.app)

    const durationMs = Date.now() - startTime

    // Collect all phases immutably (see buildStartupPhases for ordering).
    const phases = buildStartupPhases({ infraPhases, cssLabel, durationMs, bindHost: hostname })

    if (!config.silent) {
      yield* writeLockFile(server.port, configHash, configPath)
      registerLockFileCleanup(honoApp, configPath)
      yield* renderStartup(phases, url, durationMs, config.bootstrapToken)
      // Structured lifecycle record (complements the human startup banner).
      logInfo(`[server] listening on ${url}`)
    }

    return {
      server,
      url,
      stop: createStopEffect(server, aiComputeListener),
      app: honoApp,
    }
  })
