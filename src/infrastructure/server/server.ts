/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Console, Effect, Config } from 'effect'
import { Hono } from 'hono'
import { purgeOldAnalyticsData } from '@/application/use-cases/analytics/purge-old-data'
import { compileCSS } from '@/infrastructure/css/compiler'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
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
  renderStartupSummary,
  formatDuration,
  type StartupPhase,
} from '@/infrastructure/logging/logger'
import { createApiRoutes } from '@/infrastructure/server/route-setup/api-routes'
import {
  setupAuthMiddleware,
  setupAuthRoutes,
} from '@/infrastructure/server/route-setup/auth-routes'
import { setupOpenApiRoutes } from '@/infrastructure/server/route-setup/openapi-routes'
import {
  setupPageRoutes,
  type HonoAppConfig,
} from '@/infrastructure/server/route-setup/page-routes'
import { setupStaticAssets } from '@/infrastructure/server/route-setup/static-assets'
import type { ServerInstance } from '@/application/models/server'
import type { App } from '@/domain/models/app'
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
  readonly renderHomePage: (app: App, detectedLanguage?: string) => string
  readonly renderPage: (app: App, path: string, detectedLanguage?: string) => string | undefined
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string
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
export function createHonoApp(config: HonoAppConfig): Readonly<Hono> {
  const { app, renderNotFoundPage, renderErrorPage } = config

  const honoApp = new Hono()

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
      // eslint-disable-next-line functional/no-expression-statements
      await next()
    })
  }

  // Create base Hono app and chain API routes directly
  // This pattern is required for Hono RPC type inference to work correctly
  // Setup all routes by chaining the setup functions
  const honoWithRoutes = setupPageRoutes(
    setupStaticAssets(
      setupAuthRoutes(
        setupAuthMiddleware(setupOpenApiRoutes(createApiRoutes(app, honoApp)), app),
        app
      ),
      app,
      config.publicDir
    ),
    config
  )

  // Add error handlers
  return honoWithRoutes
    .notFound((c) => c.html(renderNotFoundPage(app), 404))
    .onError((error, c) => {
      // Fire-and-forget error logging (onError handler is synchronous)
      Effect.runPromise(Console.error('Server error:', error)).catch(() => {
        // Silently ignore logging failures to prevent unhandled promise rejections
      })
      return c.html(renderErrorPage(app), 500)
    })
}

/**
 * Create server stop effect
 */
const createStopEffect = (server: ReturnType<typeof Bun.serve>): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    logDebug('Stopping server...')
    yield* Effect.sync(() => server.stop())
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
  })

/**
 * Read package version from package.json
 */
const getPackageVersion = (): Effect.Effect<string, never> =>
  Effect.tryPromise({
    try: async () => {
      const pkg = (await Bun.file('./package.json').json()) as { version: string }
      return pkg.version
    },
    catch: () => '0.0.0',
  }).pipe(Effect.catchAll(() => Effect.succeed('0.0.0')))

/**
 * Collect startup phases from infrastructure initialization
 */
const collectInfraPhases = (
  app: App
): Effect.Effect<
  { readonly phases: readonly StartupPhase[]; readonly cssSizeKB: number },
  CSSCompilationError | AuthConfigRequiredForUserFields | SchemaInitializationError | Error
> =>
  Effect.gen(function* () {
    // Database phase
    const databaseUrl = yield* getDatabaseUrl()
    const databasePhases: readonly StartupPhase[] = !databaseUrl
      ? [{ label: 'DATABASE_URL not set (skipping database)', type: 'warning' as const }]
      : yield* runMigrationsIfConfigured(databaseUrl).pipe(
          Effect.flatMap(() => initializeSchema(app)),
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

    // CSS phase
    const cssResult = yield* compileCSS(app)
    const cssSizeKB = Math.round(cssResult.css.length / 1024)

    return { phases: [...databasePhases, ...smtpPhases], cssSizeKB }
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

    const {
      app,
      port = 3000,
      hostname = 'localhost',
      publicDir,
      renderHomePage,
      renderPage,
      renderNotFoundPage,
      renderErrorPage,
    } = config

    // Initialize infrastructure and collect phases
    const { phases: infraPhases, cssSizeKB } = yield* collectInfraPhases(app)

    // Create Hono app and start server
    const honoApp = createHonoApp({
      app,
      publicDir,
      renderHomePage,
      renderPage,
      renderNotFoundPage,
      renderErrorPage,
    })

    const server = yield* startBunServer(honoApp, port, hostname)
    const url = `http://${hostname}:${server.port}`
    const durationMs = Date.now() - startTime

    // Collect all phases immutably
    const phases: readonly StartupPhase[] = [
      ...infraPhases,
      { label: `CSS compiled (${cssSizeKB} KB)`, type: 'success' },
      { label: `Server ready in ${formatDuration(durationMs)}`, type: 'success' },
    ]

    // Render startup summary
    const version = yield* getPackageVersion()
    yield* renderStartupSummary({ version, phases, url, durationMs })

    return {
      server,
      url,
      stop: createStopEffect(server),
      app: honoApp,
    }
  })
