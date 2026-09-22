/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { ServerFactory } from '@/application/ports/services/server-factory'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { createRenderApp } from '@/infrastructure/server/render-app'
import {
  runDatabaseStartup,
  runDeferredStartupMaintenance,
} from '@/infrastructure/server/startup-database'
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
    // The chain itself is unchanged and unwrapped — this adapter only gives the
    // application a way to ask for it once, and returns what it produced in the
    // shape the port declares. `phases` is the infrastructure array verbatim;
    // `StartupPhaseRow` is a narrower view of the same objects, not a copy.
    startDatabase: (app, options) =>
      runDatabaseStartup(app, parseDatabaseDialectConfig(), options?.ephemeral ?? false).pipe(
        Effect.map((phases) => ({ phases }))
      ),
    runDeferredMaintenance: (app) => runDeferredStartupMaintenance(app),
    // No socket, no banner, neither boot chain — see `createRenderApp`. The
    // config arrives already narrowed to what a render reads, so this adapter
    // forwards it rather than having anything to strip out.
    buildRenderApp: (config) => createRenderApp(config),
    create: (config) =>
      createServer({
        app: config.app,
        port: config.port,
        hostname: config.hostname,
        publicDir: config.publicDir,
        silent: config.silent,
        reload: config.reload,
        databaseStartup: config.databaseStartup,
        configHash: config.configHash,
        configPath: config.configPath,
        renderPage: config.renderPage,
        renderNotFoundPage: config.renderNotFoundPage,
        renderErrorPage: config.renderErrorPage,
        ...(config.renderRssFeed !== undefined ? { renderRssFeed: config.renderRssFeed } : {}),
        ...(config.bootstrapToken !== undefined ? { bootstrapToken: config.bootstrapToken } : {}),
      }),
  }))
)
