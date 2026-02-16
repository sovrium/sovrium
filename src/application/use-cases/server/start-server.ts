/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Schema } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { ServerFactory } from '@/application/ports/services/server-factory'
import { bootstrapAdmin } from '@/application/use-cases/auth/bootstrap-admin'
import { AppSchema } from '@/domain/models/app'
import { Logger } from '@/infrastructure/logging/logger'
import type { ServerInstance } from '@/application/models/server'
import type { AuthRepository } from '@/application/ports/repositories/auth-repository'
import type { App } from '@/domain/models/app'
import type { Auth } from '@/infrastructure/auth/better-auth'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'

/**
 * Server configuration options
 */
export interface StartOptions {
  /**
   * Port number for the HTTP server
   * @default 3000
   */
  readonly port?: number

  /**
   * Hostname to bind the server to
   * @default "localhost"
   */
  readonly hostname?: string
}

/**
 * Use case for starting an Sovrium web server
 *
 * This orchestrates the server startup process:
 * 1. Validates the app configuration using Effect Schema
 * 2. Obtains rendering and server creation services via Effect Context
 * 3. Creates and starts the server via injected dependencies
 * 4. Bootstraps admin account if configured via environment variables
 *
 * Dependencies are provided via Effect.provide(AppLayer) at the application boundary.
 *
 * @param app - Application configuration
 * @param options - Server configuration options
 * @returns Effect that yields ServerInstance or errors
 *
 * @example
 * ```typescript
 * // In src/index.ts
 * const program = startServer(appConfig, { port: 3000 }).pipe(
 *   Effect.provide(AppLayer)
 * )
 * ```
 */
export const startServer = (
  app: unknown,
  options: StartOptions = {}
): Effect.Effect<
  ServerInstance,
  | AppValidationError
  | ServerCreationError
  | CSSCompilationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | Error,
  ServerFactory | PageRenderer | Auth | AuthRepository | Logger
> =>
  Effect.gen(function* () {
    // Validate app configuration using domain model schema
    const validatedApp = yield* Effect.try({
      try: (): App => Schema.decodeUnknownSync(AppSchema)(app),
      catch: (error) => new AppValidationError(error),
    })

    // Obtain dependencies from Effect Context
    const serverFactory = yield* ServerFactory
    const pageRenderer = yield* PageRenderer

    // Bootstrap admin account BEFORE starting the server
    // This ensures admin user exists before server signals "ready"
    const logger = yield* Logger
    yield* bootstrapAdmin(validatedApp).pipe(
      Effect.catchAll((error) =>
        // Log bootstrap errors but don't fail server startup
        logger.warn('Admin bootstrap error', error.message)
      )
    )

    // Create server using injected dependencies
    // Server only starts listening after bootstrap completes
    const serverInstance = yield* serverFactory.create({
      app: validatedApp,
      port: options.port,
      hostname: options.hostname,
      renderHomePage: pageRenderer.renderHome,
      renderPage: pageRenderer.renderPage,
      renderNotFoundPage: pageRenderer.renderNotFound,
      renderErrorPage: pageRenderer.renderError,
    })

    return serverInstance
  })
