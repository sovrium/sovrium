/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Scalar } from '@scalar/hono-api-reference'
import { Console, Effect } from 'effect'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import { detectLanguageFromHeader } from '@/infrastructure/utils/accept-language-parser'
import { createApiRoutes } from '@/presentation/api/app'
import { getOpenAPIDocument } from '@/presentation/api/openapi-schema'
import { auth } from '../auth/better-auth/auth'
import { compileCSS } from '../css/compiler'
import type { ServerInstance } from '@/application/models/server'
import type { App } from '@/domain/models/app'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'

/**
 * Cache duration for static assets (CSS, JS) in seconds (1 hour)
 */
const STATIC_ASSET_CACHE_DURATION_SECONDS = 3600

/**
 * Extract and validate language code from URL path
 *
 * @param path - URL path (e.g., '/fr-FR/', '/en-US/about')
 * @param supportedLanguages - Array of supported language codes
 * @returns Language code if valid, undefined otherwise
 *
 * @example
 * extractLanguageFromPath('/fr-FR/', ['en-US', 'fr-FR']) // => 'fr-FR'
 * extractLanguageFromPath('/fr-FR/about', ['en-US', 'fr-FR']) // => 'fr-FR'
 * extractLanguageFromPath('/invalid/', ['en-US', 'fr-FR']) // => undefined
 * extractLanguageFromPath('/', ['en-US', 'fr-FR']) // => undefined
 */
function extractLanguageFromPath(
  path: string,
  supportedLanguages: ReadonlyArray<string>
): string | undefined {
  // Extract first path segment (e.g., '/fr-FR/about' => 'fr-FR')
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) {
    return undefined
  }

  const potentialLang = segments[0]
  if (!potentialLang) {
    return undefined
  }

  // Validate against supported languages
  return supportedLanguages.includes(potentialLang) ? potentialLang : undefined
}

/**
 * Get array of supported language codes from app configuration
 *
 * @param app - Application configuration
 * @returns Array of language codes or empty array if languages not configured
 *
 * @example
 * getSupportedLanguageCodes(app) // => ['en-US', 'fr-FR', 'es-ES']
 */
function getSupportedLanguageCodes(app: App): ReadonlyArray<string> {
  return app.languages?.supported.map((l) => l.code) || []
}

/**
 * Detect language from Accept-Language header if browser detection is enabled
 *
 * @param app - Application configuration
 * @param header - Accept-Language HTTP header value
 * @returns Detected language code or undefined
 *
 * @example
 * detectLanguageIfEnabled(app, 'fr-FR,fr;q=0.9,en;q=0.8') // => 'fr-FR'
 * detectLanguageIfEnabled(appWithDetectionDisabled, 'fr-FR') // => undefined
 */
function detectLanguageIfEnabled(app: App, header: string | undefined): string | undefined {
  if (app.languages?.detectBrowser === false) {
    return undefined
  }
  return detectLanguageFromHeader(header, getSupportedLanguageCodes(app))
}

/**
 * Validate and extract language code from URL subdirectory path
 *
 * @param app - Application configuration
 * @param path - URL path (e.g., '/fr-FR/', '/en-US/about')
 * @returns Language code if valid subdirectory, undefined otherwise
 *
 * @example
 * validateLanguageSubdirectory(app, '/fr-FR/') // => 'fr-FR'
 * validateLanguageSubdirectory(app, '/products/pricing') // => undefined
 */
function validateLanguageSubdirectory(app: App, path: string): string | undefined {
  return extractLanguageFromPath(path, getSupportedLanguageCodes(app))
}

/**
 * Hono app configuration for route setup
 */
interface HonoAppConfig {
  readonly app: App
  readonly renderHomePage: (app: App, detectedLanguage?: string) => string
  readonly renderPage: (app: App, path: string, detectedLanguage?: string) => string | undefined
  readonly renderNotFoundPage: () => string
  readonly renderErrorPage: () => string
}

/**
 * Server configuration options
 */
export interface ServerConfig {
  readonly app: App
  readonly port?: number
  readonly hostname?: string
  readonly renderHomePage: (app: App, detectedLanguage?: string) => string
  readonly renderPage: (app: App, path: string, detectedLanguage?: string) => string | undefined
  readonly renderNotFoundPage: () => string
  readonly renderErrorPage: () => string
}

/**
 * Setup OpenAPI documentation routes
 */
function setupOpenApiRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp
    .get('/api/openapi.json', (c) => {
      const openApiDoc = getOpenAPIDocument()
      return c.json(openApiDoc)
    })
    .get('/api/auth/openapi.json', async (c) => {
      const authOpenApiDoc = await auth.api.generateOpenAPISchema()
      return c.json(authOpenApiDoc)
    })
    .get(
      '/api/scalar',
      Scalar({
        pageTitle: 'Sovrium API Documentation',
        theme: 'default',
        sources: [
          { url: '/api/openapi.json', title: 'API' },
          { url: '/api/auth/openapi.json', title: 'Auth' },
        ],
      })
    )
}

/**
 * Setup CORS middleware for Better Auth endpoints
 */
function setupAuthMiddleware(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp.use(
    '/api/auth/*',
    cors({
      origin: (origin) => {
        // Allow all localhost origins for development and testing
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return origin
        }
        // In production, this should be configured with specific allowed origins
        return origin
      },
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true, // Required for cookie-based authentication
    })
  )
}

/**
 * Setup Better Auth routes
 */
function setupAuthRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))
}

/**
 * Setup CSS compilation route
 */
function setupCSSRoute(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  return honoApp.get('/assets/output.css', async (c) => {
    try {
      const result = await Effect.runPromise(
        compileCSS(app).pipe(Effect.tap(() => Console.log('CSS compiled successfully')))
      )

      return c.text(result.css, 200, {
        'Content-Type': 'text/css',
        'Cache-Control': `public, max-age=${STATIC_ASSET_CACHE_DURATION_SECONDS}`,
      })
    } catch (error) {
      // Log error - intentional side effect for error tracking
      // eslint-disable-next-line functional/no-expression-statements
      await Effect.runPromise(Console.error('CSS compilation failed:', error))
      return c.text('/* CSS compilation failed */', 500, {
        'Content-Type': 'text/css',
      })
    }
  })
}

/**
 * Setup JavaScript asset routes
 */
function setupJavaScriptRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp
    .get('/assets/language-switcher.js', async (c) => {
      try {
        const scriptPath = './src/presentation/scripts/client/language-switcher.js'
        const file = Bun.file(scriptPath)
        const content = await file.text()

        return c.text(content, 200, {
          'Content-Type': 'application/javascript',
          'Cache-Control': `public, max-age=${STATIC_ASSET_CACHE_DURATION_SECONDS}`,
        })
      } catch (error) {
        // eslint-disable-next-line functional/no-expression-statements
        await Effect.runPromise(Console.error('Failed to load language-switcher.js:', error))
        return c.text('/* Language switcher script failed to load */', 500, {
          'Content-Type': 'application/javascript',
        })
      }
    })
    .get('/assets/banner-dismiss.js', async (c) => {
      try {
        const scriptPath = './src/presentation/scripts/client/banner-dismiss.js'
        const file = Bun.file(scriptPath)
        const content = await file.text()

        return c.text(content, 200, {
          'Content-Type': 'application/javascript',
          'Cache-Control': `public, max-age=${STATIC_ASSET_CACHE_DURATION_SECONDS}`,
        })
      } catch (error) {
        // eslint-disable-next-line functional/no-expression-statements
        await Effect.runPromise(Console.error('Failed to load banner-dismiss.js:', error))
        return c.text('/* Banner dismiss script failed to load */', 500, {
          'Content-Type': 'application/javascript',
        })
      }
    })
}

/**
 * Setup static asset routes (CSS and JavaScript)
 */
function setupStaticAssets(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  return setupJavaScriptRoutes(setupCSSRoute(honoApp, app))
}

/**
 * Setup homepage route
 */
function setupHomepageRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderHomePage, renderErrorPage } = config

  return honoApp.get('/', (c) => {
    try {
      // If no languages configured, render with default (en-US)
      if (!app.languages) {
        const html = renderHomePage(app, undefined)
        return c.html(html)
      }

      // If browser detection disabled, always serve default language at /
      if (app.languages.detectBrowser === false) {
        const html = renderHomePage(app, undefined)
        return c.html(html)
      }

      // Browser detection enabled - detect language from Accept-Language header
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const targetLanguage = detectedLanguage || app.languages.default

      // Only redirect if detected language is different from default
      if (targetLanguage !== app.languages.default) {
        return c.redirect(`/${targetLanguage}/`, 302)
      }

      // Same as default - serve at / (no redirect, cacheable)
      const html = renderHomePage(app, undefined)
      return c.html(html)
    } catch (error) {
      Effect.runSync(Console.error('Error rendering homepage:', error))
      return c.html(renderErrorPage(), 500)
    }
  })
}

/**
 * Setup language subdirectory routes
 */
function setupLanguageRoutes(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderHomePage, renderPage, renderNotFoundPage, renderErrorPage } = config

  return honoApp
    .get('/:lang/', (c) => {
      try {
        // Check if a page exists at this exact path first (e.g., /fr/ as a page path)
        // Strip trailing slash to match page paths without it
        const pathWithoutTrailingSlash = c.req.path.replace(/\/$/, '')
        const exactPageHtml = renderPage(app, pathWithoutTrailingSlash)
        if (exactPageHtml) {
          return c.html(exactPageHtml)
        }

        // No exact page match - treat as language subdirectory
        const urlLanguage = validateLanguageSubdirectory(app, c.req.path)
        if (!urlLanguage) {
          return c.html(renderNotFoundPage(), 404)
        }
        const html = renderHomePage(app, urlLanguage)
        return c.html(html)
      } catch (error) {
        Effect.runSync(Console.error('Error rendering homepage:', error))
        return c.html(renderErrorPage(), 500)
      }
    })
    .get('/:lang/*', (c) => {
      try {
        const urlLanguage = validateLanguageSubdirectory(app, c.req.path)

        if (!urlLanguage) {
          const { path } = c.req
          const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
          const html = renderPage(app, path, detectedLanguage)
          if (!html) {
            return c.html(renderNotFoundPage(), 404)
          }
          return c.html(html)
        }

        const pathWithoutLang = c.req.path.replace(`/${urlLanguage}`, '') || '/'
        const html = renderPage(app, pathWithoutLang, urlLanguage)
        if (!html) {
          return c.html(renderNotFoundPage(), 404)
        }
        return c.html(html)
      } catch (error) {
        Effect.runSync(Console.error('Error rendering page:', error))
        return c.html(renderErrorPage(), 500)
      }
    })
}

/**
 * Setup dynamic page routes
 */
function setupDynamicPageRoutes(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderPage, renderNotFoundPage } = config

  return honoApp.get('*', (c) => {
    const { path } = c.req
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    const html = renderPage(app, path, detectedLanguage)
    if (!html) {
      return c.html(renderNotFoundPage(), 404)
    }
    return c.html(html)
  })
}

/**
 * Setup test error route
 */
function setupTestErrorRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { renderNotFoundPage } = config

  return honoApp.get('/test/error', (c) => {
    if (process.env.NODE_ENV === 'production') {
      return c.html(renderNotFoundPage(), 404)
    }
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error('Test error')
  })
}

/**
 * Setup page routes (homepage, language subdirectories, dynamic pages)
 */
function setupPageRoutes(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  return setupDynamicPageRoutes(
    setupLanguageRoutes(setupTestErrorRoute(setupHomepageRoute(honoApp, config), config), config),
    config
  )
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
 */
function createHonoApp(config: HonoAppConfig): Readonly<Hono> {
  const { app, renderNotFoundPage, renderErrorPage } = config

  // Create base Hono app and chain API routes directly
  // This pattern is required for Hono RPC type inference to work correctly
  // Setup all routes by chaining the setup functions
  const honoWithRoutes = setupPageRoutes(
    setupStaticAssets(
      setupAuthRoutes(setupAuthMiddleware(setupOpenApiRoutes(createApiRoutes(app, new Hono())))),
      app
    ),
    config
  )

  // Add error handlers
  return honoWithRoutes
    .notFound((c) => c.html(renderNotFoundPage(), 404))
    .onError((error, c) => {
      // Fire-and-forget error logging (onError handler is synchronous)
      Effect.runPromise(Console.error('Server error:', error)).catch(() => {
        // Silently ignore logging failures to prevent unhandled promise rejections
      })
      return c.html(renderErrorPage(), 500)
    })
}

/**
 * Create server stop effect
 */
function createStopEffect(server: ReturnType<typeof Bun.serve>): Effect.Effect<void, never> {
  return Effect.gen(function* () {
    yield* Console.log('Stopping server...')
    yield* Effect.sync(() => server.stop())
    yield* Console.log('Server stopped')
  })
}

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
export const createServer = (
  config: ServerConfig
): Effect.Effect<ServerInstance, ServerCreationError | CSSCompilationError> =>
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
    yield* Console.log('✓ Server started successfully!')
    yield* Console.log(`✓ Homepage: ${url}`)
    yield* Console.log(`✓ Health check: ${url}/api/health`)
    yield* Console.log(`✓ API documentation: ${url}/api/scalar`)
    yield* Console.log(`✓ OpenAPI schema: ${url}/api/openapi.json`)
    yield* Console.log(`✓ Compiled CSS: ${url}/assets/output.css`)

    // Create stop effect
    const stop = createStopEffect(server)

    return {
      server,
      url,
      stop,
    }
  })
