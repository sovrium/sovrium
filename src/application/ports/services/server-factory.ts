/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { ServerInstance } from '@/application/models/server'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/types/session-info'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'
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
      /** [internal ref]..039: the `/:lang/` URL-prefix locale, when present. */
      readonly urlLanguage?: string
    }
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  /**
   * RSS feed renderer ([internal ref] — [internal ref]).
   *
   * Optional so callers (eg. SSG) that don't yet wire RSS through still
   * compile — the Hono `/feed.xml` route 404s when undefined.
   */
  readonly renderRssFeed?: (app: App, baseUrl: string) => Promise<string | undefined>
  /**
   * One-time plaintext bootstrap token, threaded down from `startServer`'s
   * `bootstrapAdminAndToken` when a fresh token was generated this boot. The
   * server factory hands it to `renderStartupSummary` so the clean startup
   * banner gets a `→ First-admin token (POST …)` footer line. `undefined`
   * (the default) means no token was generated — the banner is unchanged.
   */
  readonly bootstrapToken?: string
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
     * @returns Effect that yields ServerInstance or creation/compilation/auth config/migration errors
     */
    readonly create: (
      config: ServerFactoryConfig
    ) => Effect.Effect<
      ServerInstance,
      | ServerCreationError
      | CSSCompilationError
      | AuthConfigRequiredForUserFields
      | SchemaInitializationError
      | TransformPresetError
      | Error
    >
  }
>() {}
