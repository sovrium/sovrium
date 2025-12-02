/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Console, Effect, Config } from 'effect'
import { Hono } from 'hono'
import { compileCSS } from '@/infrastructure/css/compiler'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import {
  initializeSchema,
  type AuthConfigRequiredForUserFields,
  type SchemaInitializationError,
} from '@/infrastructure/database/schema-initializer'
import { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
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
import { createApiRoutes } from '@/presentation/api/app'
import type { ServerInstance } from '@/application/models/server'
import type { App } from '@/domain/models/app'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'

/**
 * Server configuration options
 */
export interface ServerConfig {
  readonly app: App
  readonly port?: number
  readonly hostname?: string
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

  // Create base Hono app and chain API routes directly
  // This pattern is required for Hono RPC type inference to work correctly
  // Setup all routes by chaining the setup functions
  const honoWithRoutes = setupPageRoutes(
    setupStaticAssets(
      setupAuthRoutes(
        setupAuthMiddleware(setupOpenApiRoutes(createApiRoutes(app, new Hono()))),
        app
      ),
      app
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
    yield* Console.log('Stopping server...')
    yield* Effect.sync(() => server.stop())
    yield* Console.log('Server stopped')
  })

/**
 * Log server startup information
 */
const logServerStartup = (url: string): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* Console.log('✓ Server started successfully!')
    yield* Console.log(`✓ Homepage: ${url}`)
    yield* Console.log(`✓ Health check: ${url}/api/health`)
    yield* Console.log(`✓ API documentation: ${url}/api/scalar`)
    yield* Console.log(`✓ OpenAPI schema: ${url}/api/openapi.json`)
    yield* Console.log(`✓ Compiled CSS: ${url}/assets/output.css`)
  })

/**
 * Creates and starts a Bun server with Hono
 *
 * This function:
 * 1. Pre-compiles CSS on startup for faster initial requests
 * 2. Creates a Hono app with routes (/, /assets/output.css, /api/*)
 * 3. Starts a Bun HTTP server
 * 4. Returns server instance with stop capability
 *
 * @param config - Server configuration with app data and optional port/hostname
 * @returns Effect that yields ServerInstance or ServerCreationError
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const server = yield* createServer({
 *     app: { name: 'My App' },
 *     port: 3000
 *   })
 *   console.log(`Server running at ${server.url}`)
 * })
 *
 * Effect.runPromise(program)
 * ```
 */
// @knip-ignore - Used via dynamic import in StartServer.ts
// eslint-disable-next-line max-lines-per-function -- Server factory requires comprehensive setup
export const createServer = (
  config: ServerConfig
): Effect.Effect<
  ServerInstance,
  | ServerCreationError
  | CSSCompilationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
> =>
  // eslint-disable-next-line max-lines-per-function -- Server setup generator needs comprehensive initialization
  Effect.gen(function* () {
    const {
      app,
      port = 3000,
      hostname = 'localhost',
      renderHomePage,
      renderPage,
      renderNotFoundPage,
      renderErrorPage,
    } = config

    // Get database URL from Effect Config (reads from environment)
    // Catch ConfigError and convert to empty string (no DATABASE_URL = skip migrations)
    const databaseUrl = yield* Config.string('DATABASE_URL')
      .pipe(Config.withDefault(''))
      .pipe(
        Effect.catchAll(() => Effect.succeed('')) // If config fails, use empty string
      )

    // Run Drizzle migrations for Better Auth tables (if DATABASE_URL is configured)
    yield* Console.log(`[createServer] DATABASE_URL: ${databaseUrl ? 'present' : 'missing'}`)
    yield* Console.log(`[createServer] app.auth: ${app.auth ? 'configured' : 'not configured'}`)
    if (databaseUrl && app.auth) {
      yield* Console.log('[createServer] Running migrations...')
      yield* runMigrations(databaseUrl).pipe(
        Effect.catchAll((error) => {
          // Log error but don't fail - allow server to start even if migrations fail
          // This is useful for development where the database might not be ready yet
          return Console.error(`Migration warning: ${error.message}`)
        })
      )
    } else {
      yield* Console.log('[createServer] Skipping migrations (no DATABASE_URL or no auth config)')
    }

    // Initialize database schema from app configuration
    yield* initializeSchema(app)

    // Pre-compile CSS on startup
    yield* Console.log('Compiling CSS...')
    const cssResult = yield* compileCSS(app)
    yield* Console.log(`CSS compiled: ${cssResult.css.length} bytes`)

    // Create Hono app with config object
    const honoApp = createHonoApp({
      app,
      renderHomePage,
      renderPage,
      renderNotFoundPage,
      renderErrorPage,
    })

    // Start Bun server
    const server = yield* Effect.try({
      try: () =>
        Bun.serve({
          port,
          hostname,
          fetch: honoApp.fetch,
        }),
      catch: (error) => new ServerCreationError(error),
    })

    // Use actual port from server (important when port is 0)
    const actualPort = server.port
    const url = `http://${hostname}:${actualPort}`

    // Log server startup information
    yield* logServerStartup(url)

    // Create stop effect
    const stop = createStopEffect(server)

    return {
      server,
      url,
      stop,
      app: honoApp,
    }
  })
