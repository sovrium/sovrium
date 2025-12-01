/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { ServerInstance } from '@/application/models/server'
import type { App } from '@/domain/models/app'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { Effect } from 'effect'

/**
 * Server factory port for creating web servers
 *
 * This interface defines the contract for server creation,
 * allowing the Application layer to remain decoupled from
 * Infrastructure implementations.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const serverFactory = yield* ServerFactory
 *   const server = yield* serverFactory.create({
 *     app: validatedApp,
 *     port: 3000,
 *     renderHomePage: (app) => '<html>...</html>',
 *     renderNotFoundPage: () => '<html>404</html>',
 *     renderErrorPage: () => '<html>Error</html>',
 *   })
 *   return server
 * })
 * ```
 */

/**
 * Configuration for server creation
 */
export interface ServerFactoryConfig {
  readonly app: App
  readonly port?: number
  readonly hostname?: string
  readonly renderHomePage: (app: App) => string
  readonly renderPage: (app: App, path: string) => string | undefined
  readonly renderNotFoundPage: () => string
  readonly renderErrorPage: () => string
}

/**
 * ServerFactory service for creating and starting web servers
 *
 * Use this service via Effect Context to create server instances
 * with type-safe dependency injection.
 */
export class ServerFactory extends Context.Tag('ServerFactory')<
  ServerFactory,
  {
    /**
     * Creates and starts a server instance
     *
     * @param config - Server configuration with app data and rendering functions
     * @returns Effect that yields ServerInstance or creation/compilation/auth config errors
     */
    readonly create: (
      config: ServerFactoryConfig
    ) => Effect.Effect<
      ServerInstance,
      | ServerCreationError
      | CSSCompilationError
      | AuthConfigRequiredForUserFields
      | SchemaInitializationError
    >
  }
>() {}
