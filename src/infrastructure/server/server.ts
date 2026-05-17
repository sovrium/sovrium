/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFileSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { Effect, Config } from 'effect'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { AiService } from '@/application/ports/services/ai-service'
import { purgeOldAnalyticsData } from '@/application/use-cases/analytics/purge-old-data'
import { AiLive } from '@/infrastructure/ai/layer'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { runSeedAllConnectionDefinitions } from '@/infrastructure/connections/test-token-seeder'
import { compileCSS } from '@/infrastructure/css/compiler'
import { AiComputeListener } from '@/infrastructure/database/ai-compute-listener'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { isAiComputeFieldType } from '@/infrastructure/database/generators/ai-field-triggers'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics-repository-live'
import {
  initializeSchema,
  type AuthConfigRequiredForUserFields,
  type SchemaInitializationError,
} from '@/infrastructure/database/schema/schema-initializer'
import { getEmailConfigFromEffect } from '@/infrastructure/email/email-config'
import { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import {
  logDebug,
  logError,
  renderStartupSummary,
  formatDuration,
  type StartupPhase,
} from '@/infrastructure/logging/logger'
import {
  disposeCronScheduler,
  registerCronAutomations,
} from '@/infrastructure/scheduling/register-cron-automations'
import {
  computeConfigHash,
  writeLockFile as writeLockFileToDisk,
} from '@/infrastructure/server/lock-file'
import { requestLogger } from '@/infrastructure/server/middleware/request-logger'
import { createApiRoutes } from '@/infrastructure/server/route-setup/api-routes'
import {
  setupAuthMiddleware,
  setupAuthRoutes,
} from '@/infrastructure/server/route-setup/auth-routes'
import { setupBootstrapRoutes } from '@/infrastructure/server/route-setup/bootstrap-routes'
import { setupMcpRoutes } from '@/infrastructure/server/route-setup/mcp/routes'
import { setupOpenApiRoutes } from '@/infrastructure/server/route-setup/openapi-routes'
import {
  setupPageRoutes,
  type HonoAppConfig,
} from '@/infrastructure/server/route-setup/page-routes'
import { setupStaticAssets } from '@/infrastructure/server/route-setup/static-assets'
import { resolvePackagePath } from '@/infrastructure/utils/package-paths'
import type { ServerInstance } from '@/application/models/server'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/types/session-info'
import type {
  DatabaseConnectionError,
  MigrationError,
} from '@/infrastructure/database/drizzle/migrate'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { Server } from 'bun'

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
    }
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  /**
   * RSS feed renderer (US-PAGES-ACCESS-PUBLISHING-004 — APP-PAGES-PUBLISHING-014).
   *
   * Optional so SSG and legacy callers that don't yet pass through the
   * RSS pipeline keep working — the route handler 404s when undefined.
   */
  readonly renderRssFeed?: (app: App, baseUrl: string) => Promise<string | undefined>
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
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>
): (headers: Headers) => Promise<SessionInfo | undefined> {
  return async (headers) => {
    try {
      const session = await authInstance.api.getSession({ headers })
      if (!session) return undefined
      // Admin plugin adds `role` to user at runtime (not in base type)
      const user = session.user as { id: string; email?: string; role?: string }
      const role = user.role ?? 'member'
      // Better Auth admin plugin grants global, unrestricted access to users
      // whose role is 'admin'. The Z-1 `$currentUser.isUnrestricted` flag
      // mirrors that — see docs/customers/sovrium-services.md §2.2 Z-1.
      const isUnrestricted = role === 'admin'
      return {
        userId: user.id,
        role,
        email: user.email,
        isUnrestricted,
      }
    } catch {
      return undefined
    }
  }
}

// eslint-disable-next-line max-lines-per-function -- X-Sovrium-Config middleware adds lines
export function createHonoApp(
  config: HonoAppConfig & { readonly configHash?: string }
): Readonly<Hono> {
  const { app, renderNotFoundPage, renderErrorPage, configHash } = config

  // Create auth instance once — shared between auth routes and page session extraction.
  // `app.connections` is forwarded to the user-create databaseHook so the
  // test-mode token seeder (no-op in production) can auto-populate
  // `system.connection_tokens` for newly registered users without
  // requiring each spec to drive the real OAuth round-trip.
  const authInstance = app.auth ? createAuthInstance(app.auth, app.connections) : undefined
  const getSession = authInstance ? buildGetSession(authInstance) : undefined

  // Inject getSession into config for page route handlers
  const configWithSession = { ...config, getSession }

  const honoApp = new Hono()

  // Security response headers. Applied first so every response carries them.
  // Hono's defaults give a strong baseline (X-Frame-Options: SAMEORIGIN,
  // X-Content-Type-Options: nosniff, X-XSS-Protection: 0, COOP/CORP same-origin,
  // Origin-Agent-Cluster: ?1); we override HSTS max-age and Referrer-Policy.
  // Content-Security-Policy is intentionally left at its default (not set) —
  // apps may register a CSP via their schema-driven layer once that hook lands.
  // eslint-disable-next-line functional/no-expression-statements
  honoApp.use(
    '*',
    secureHeaders({
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
  )

  // X-Sovrium-Config response header middleware
  // Uses a mutable ref so reload (SIGUSR1) can update it without restarting
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
          Effect.catchAll(() => Effect.void)
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

  const honoWithRoutes = setupPageRoutes(
    setupStaticAssets(
      setupMcpRoutes(
        setupAuthRoutes(
          setupAuthMiddleware(
            setupOpenApiRoutes(createApiRoutes(app, honoWithBootstrap as Hono), app),
            app
          ),
          app,
          authInstance
        ),
        app
      ),
      app,
      config.publicDir
    ),
    configWithSession
  )

  // Add error handlers
  return honoWithRoutes
    .notFound(async (c) => c.html(await renderNotFoundPage(app), 404))
    .onError(async (error, c) => {
      logError(`[SERVER] ${c.req.method} ${c.req.path} → 500`, error)
      return c.html(await renderErrorPage(app), 500)
    })
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
 * Create server stop effect. Also tears down the cron scheduler so timer
 * cleanup is belt-and-braces (APP-AUTOMATION-TRIGGER-SCHEDULE-013).
 */
const createStopEffect = (
  server: ReturnType<typeof Bun.serve>,
  aiComputeListener?: Readonly<AiComputeListener>
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    logDebug('Stopping server...')
    disposeCronScheduler() // belt-and-braces: child-process kill already clears timers
    if (aiComputeListener) yield* Effect.promise(() => aiComputeListener.stop().catch(() => {}))
    yield* Effect.promise(() => server.stop())
    logDebug('Server stopped')
  })

/**
 * Get database URL from environment configuration
 */
const getDatabaseUrl = (): Effect.Effect<string, never> =>
  Config.string('DATABASE_URL').pipe(
    Config.withDefault(''),
    Effect.catchAll(() => Effect.succeed(''))
  )

/**
 * Run migrations if database URL is configured
 */
const runMigrationsIfConfigured = (
  databaseUrl: string
): Effect.Effect<
  void,
  DatabaseConnectionError | MigrationError | SchemaInitializationError,
  never
> => (databaseUrl ? runMigrations(databaseUrl) : Effect.void)

/**
 * Start Bun HTTP server
 */
const startBunServer = (
  honoApp: Readonly<Hono>,
  port: number,
  hostname: string
): Effect.Effect<Server<undefined>, ServerCreationError, never> =>
  Effect.try({
    try: () =>
      Bun.serve({
        port,
        hostname,
        fetch: honoApp.fetch,
      }),
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
          try: () =>
            Bun.serve({
              port: 0,
              hostname,
              fetch: honoApp.fetch,
            }),
          catch: (error) => new ServerCreationError(error),
        })
    )
  )

/**
 * Read package version from package.json
 */
const getPackageVersion = (): Effect.Effect<string, never> =>
  Effect.tryPromise({
    try: async () => {
      const pkg = (await Bun.file(resolvePackagePath('package.json')).json()) as { version: string }
      return pkg.version
    },
    catch: () => '0.0.0',
  }).pipe(Effect.catchAll(() => Effect.succeed('0.0.0')))

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
    const tables = app.tables ?? []
    const hasAiComputeField = tables.some((table) =>
      table.fields.some((field) => isAiComputeFieldType(field.type))
    )
    if (!hasAiComputeField) return undefined

    const aiService = yield* AiService
    if (!aiService.isConfigured()) return undefined

    return new AiComputeListener(databaseUrl)
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
 * Detect the "no-storage stub" branch in storage-service-live.ts and emit a
 * startup warning so users see at startup that attachment fields will
 * fail-fast (instead of discovering it on the first upload).
 *
 * The text here matches the docstring in storage-service-live.ts:169 verbatim
 * so a "grep for the warning" search works from either side. Empty-string is
 * treated as unset to mirror the test contract in
 * specs/buckets/configuration/storage-provider-startup-logging.spec.ts:138
 * (`env: { STORAGE_PROVIDER: '', DATABASE_URL: '' }`).
 */
const collectStoragePhases = (databaseUrl: string): readonly StartupPhase[] => {
  const storageProvider = process.env.STORAGE_PROVIDER ?? ''
  if (databaseUrl || storageProvider !== '') return []
  return [
    {
      label: 'Storage: Not configured (attachment fields will be disabled)',
      type: 'warning' as const,
    },
  ]
}

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
    // Database phase
    const databaseUrl = yield* getDatabaseUrl()
    const databasePhases: readonly StartupPhase[] = !databaseUrl
      ? [{ label: 'DATABASE_URL not set (skipping database)', type: 'warning' as const }]
      : yield* runMigrationsIfConfigured(databaseUrl).pipe(
          Effect.flatMap(() => initializeSchema(app)),
          // Seed `system.connections` rows for every connection in
          // `app.connections[]` so the auth-headers injection path can
          // verify "the connection wasn't deleted at runtime" before
          // building the outbound auth header. Idempotent upsert keyed
          // on `name`; safe across server restarts and config reloads.
          Effect.flatMap(() =>
            Effect.promise(() => runSeedAllConnectionDefinitions({ connections: app.connections }))
          ),
          Effect.map(() => [{ label: 'Database connected', type: 'success' as const }])
        )

    // SMTP check (only relevant when auth is configured)
    const smtpPhases: readonly StartupPhase[] =
      app.auth && getEmailConfigFromEffect().usingMailpitFallback
        ? [
            {
              label: 'SMTP not configured (using Mailpit at 127.0.0.1:1025)',
              type: 'warning' as const,
            },
          ]
        : []

    // Storage check — see collectStoragePhases for the contract.
    const storagePhases = collectStoragePhases(databaseUrl)

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
      phases: [...databasePhases, ...smtpPhases, ...storagePhases],
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
  ).pipe(Effect.catchAll(() => Effect.void))

/**
 * Synchronous lock file cleanup — removes .sovrium.lock only if PID matches.
 * Must be at module scope for consistent-function-scoping lint rule.
 */
const cleanupLockFileSync = (): void => {
  try {
    const lockDir = process.env.SOVRIUM_LOCK_DIR || process.cwd()
    const lockPath = `${lockDir}/.sovrium.lock`
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

  // SIGUSR1 handler: re-read config and update the X-Sovrium-Config header hash
  // eslint-disable-next-line functional/no-expression-statements
  process.on('SIGUSR1', async () => {
    if (!configPath) return
    try {
      const content = await readFile(configPath, 'utf-8')
      const newHash = computeConfigHash(content)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setter = (honoApp as any).__setConfigHash as ((hash: string) => void) | undefined
      if (setter) setter(newHash)
    } catch {
      // Ignore errors during reload
    }
  })
}

/**
 * Render startup summary with version, phases, and server URL
 */
const renderStartup = (
  phases: readonly StartupPhase[],
  url: string,
  durationMs: number
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const version = yield* getPackageVersion()
    yield* renderStartupSummary({ version, phases, url, durationMs })
  })

/**
 * Build the Hono application from a ServerConfig. Pure construction — no
 * network binding. Extracted to keep `createServer` under the max-lines limit.
 */
const buildHonoAppFromConfig = (config: ServerConfig): Readonly<Hono> =>
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
  | Error
> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    const port = config.port ?? parsePort(Bun.env.PORT) ?? 3000
    const hostname = config.hostname ?? (Bun.env.HOSTNAME || 'localhost')
    const configHash = config.configHash ?? ''
    const configPath = config.configPath ?? ''

    // Initialize infrastructure and collect phases
    const {
      phases: infraPhases,
      cssLabel,
      aiComputeListener,
    } = yield* collectInfraPhases(config.app)

    // Create Hono app and start server
    const honoApp = buildHonoAppFromConfig(config)
    const server = yield* startBunServer(honoApp, port, hostname)
    const url = `http://${hostname}:${server.port}`

    // Arm cron-triggered automations on the live scheduler (non-blocking).
    yield* registerCronAutomations(config.app, process.env)

    const durationMs = Date.now() - startTime

    // Collect all phases immutably
    const phases: readonly StartupPhase[] = [
      ...infraPhases,
      { label: cssLabel, type: 'success' },
      { label: `Server ready in ${formatDuration(durationMs)}`, type: 'success' },
    ]

    if (!config.silent) {
      yield* writeLockFile(server.port, configHash, configPath)
      registerLockFileCleanup(honoApp, configPath)
      yield* renderStartup(phases, url, durationMs)
    }

    return {
      server,
      url,
      stop: createStopEffect(server, aiComputeListener),
      app: honoApp,
    }
  })
