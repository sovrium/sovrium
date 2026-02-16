/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { ServerFactory } from '@/application/ports/services/server-factory'
import { createServer } from './server'

/**
 * Live implementation of ServerFactory using Bun.serve
 *
 * This Layer provides the production server creation logic,
 * wrapping the infrastructure createServer function in an
 * Effect Context service.
 *
 * The implementation uses Layer.effect because createServer
 * returns an Effect (async operations with error handling).
 *
 * @example
 * ```typescript
 * // Provide ServerFactoryLive to use cases
 * const program = startServer(appConfig).pipe(
 *   Effect.provide(ServerFactoryLive)
 * )
 * ```
 */
export const ServerFactoryLive = Layer.effect(
  ServerFactory,
  Effect.sync(() => ({
    create: (config) =>
      createServer({
        app: config.app,
        port: config.port,
        hostname: config.hostname,
        renderHomePage: config.renderHomePage,
        renderPage: config.renderPage,
        renderNotFoundPage: config.renderNotFoundPage,
        renderErrorPage: config.renderErrorPage,
      }),
  }))
)
