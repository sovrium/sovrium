/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium - A Bun web framework with React SSR and Tailwind CSS
 *
 * This is the main entry point for Sovrium applications. It provides a simple
 * Promise-based API for starting a web server with automatic:
 * - React 19 server-side rendering
 * - Tailwind CSS compilation (no build step)
 * - Type-safe configuration validation
 * - Graceful shutdown handling
 */

import { Console, Effect } from 'effect'
import { generateStatic as generateStaticUseCase } from '@/application/use-cases/server/generate-static'
import { startServer } from '@/application/use-cases/server/start-server'
import { AppLayer } from '@/infrastructure/layers/app-layer'
import { withGracefulShutdown } from '@/infrastructure/server/lifecycle'
import type { ServerInstance } from '@/application/models/server'
import type {
  GenerateStaticOptions,
  GenerateStaticResult,
} from '@/application/use-cases/server/generate-static'
import type { StartOptions } from '@/application/use-cases/server/start-server'

/**
 * Simple server interface with Promise-based methods
 */
export interface SimpleServer {
  /**
   * Server URL (e.g., "http://localhost:3000")
   */
  readonly url: string

  /**
   * Stop the server gracefully
   * @returns Promise that resolves when server is stopped
   */
  stop: () => Promise<void>
}

/**
 * Convert Effect-based ServerInstance to simple Promise-based interface
 */
const toSimpleServer = (server: Readonly<ServerInstance>): SimpleServer => ({
  url: server.url,
  stop: () => Effect.runPromise(server.stop),
})

/**
 * Start an Sovrium server with automatic logging and graceful shutdown
 *
 * This is the main entry point for Sovrium applications. It:
 * 1. Validates the app configuration using Effect Schema
 * 2. Compiles Tailwind CSS dynamically using PostCSS
 * 3. Creates a Hono web server with React SSR
 * 4. Serves the homepage at "/" and compiled CSS at "/assets/output.css"
 * 5. Sets up graceful shutdown handlers (SIGINT, SIGTERM)
 * 6. Returns a simple server interface with url and stop method
 *
 * @param app - Application configuration with name and description
 * @param options - Optional server configuration (port, hostname)
 * @returns Promise that resolves to a simple server interface
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { start } from 'sovrium'
 *
 * const myApp = {
 *   name: 'My App',
 *   description: 'A simple Bun application'
 * }
 *
 * // Start with default port (3000) and hostname ('localhost')
 * const server = await start(myApp)
 * console.log(`Server running at ${server.url}`)
 * // Server stays alive until Ctrl+C
 * ```
 *
 * @example
 * With custom configuration:
 * ```typescript
 * const server = await start(myApp, {
 *   port: 8080,
 *   hostname: '0.0.0.0'
 * })
 * ```
 *
 * @example
 * With error handling:
 * ```typescript
 * start(myApp).catch((error) => {
 *   console.error('Failed to start server:', error)
 *   process.exit(1)
 * })
 * ```
 */
export const start = async (app: unknown, options: StartOptions = {}): Promise<SimpleServer> => {
  const program = Effect.gen(function* () {
    yield* Console.log('Starting Sovrium server...')

    // Start the server (dependencies injected via AppLayer)
    const server = yield* startServer(app, options)

    // Setup graceful shutdown (keeps process alive)
    // Use return yield* to signal this never returns (Effect.never in withGracefulShutdown)
    return yield* withGracefulShutdown(server)
  }).pipe(
    // Provide dependencies (ServerFactory + PageRenderer)
    Effect.provide(AppLayer)
  )

  // Run the Effect program and convert to simple server interface
  const server = await Effect.runPromise(program)
  return toSimpleServer(server)
}

/**
 * Generate static site files from an Sovrium application
 *
 * This function generates static HTML files and supporting assets that can be
 * deployed to any static hosting provider (GitHub Pages, Netlify, Vercel, etc.).
 *
 * @param app - Application configuration with pages, theme, etc.
 * @param options - Optional static generation configuration
 * @returns Promise that resolves to generation result with output directory and file list
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { generateStatic } from 'sovrium'
 *
 * const myApp = {
 *   name: 'My App',
 *   pages: [
 *     {
 *       name: 'home',
 *       path: '/',
 *       meta: { title: 'Home' },
 *       sections: []
 *     }
 *   ]
 * }
 *
 * const result = await generateStatic(myApp)
 * console.log(`Generated ${result.files.length} files to ${result.outputDir}`)
 * ```
 *
 * @example
 * With options:
 * ```typescript
 * const result = await generateStatic(myApp, {
 *   outputDir: './build',
 *   baseUrl: 'https://example.com',
 *   generateSitemap: true,
 *   generateRobotsTxt: true,
 *   deployment: 'github-pages'
 * })
 * ```
 */
export const generateStatic = async (
  app: unknown,
  options: GenerateStaticOptions = {}
): Promise<GenerateStaticResult> => {
  const program = Effect.gen(function* () {
    yield* Console.log('Generating static site...')

    // Generate static site (dependencies injected via AppLayer)
    const result = yield* generateStaticUseCase(app, options)

    yield* Console.log(`✅ Static site generated to ${result.outputDir}`)
    yield* Console.log(`   Generated ${result.files.length} files`)

    return result
  }).pipe(
    // Provide dependencies (ServerFactory + PageRenderer)
    Effect.provide(AppLayer)
  )

  // Run the Effect program and return the result
  return await Effect.runPromise(program)
}

/**
 * Re-export types for convenience
 */
export type { StartOptions, GenerateStaticOptions, GenerateStaticResult }
export type { App, AppEncoded } from '@/domain/models/app'
export { AppSchema } from '@/domain/models/app'
export type { Page, PageEncoded } from '@/domain/models/app/pages'
export { PageSchema } from '@/domain/models/app/pages'
