/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { ServerFactory } from '@/application/ports/services/server-factory'
import { createServer } from './server'

export const ServerFactoryLive = Layer.effect(
  ServerFactory,
  Effect.sync(() => ({
    create: (config) =>
      createServer({
        app: config.app,
        port: config.port,
        hostname: config.hostname,
        publicDir: config.publicDir,
        silent: config.silent,
        configHash: config.configHash,
        configPath: config.configPath,
        renderPage: config.renderPage,
        renderNotFoundPage: config.renderNotFoundPage,
        renderErrorPage: config.renderErrorPage,
        ...(config.renderRssFeed !== undefined ? { renderRssFeed: config.renderRssFeed } : {}),
      }),
  }))
)
