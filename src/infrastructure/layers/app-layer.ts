/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { createAuthLayer } from '@/infrastructure/auth/better-auth'
import { CSSCompilerLive } from '@/infrastructure/css/css-compiler-live'
import { DevToolsLayerOptional } from '@/infrastructure/devtools'
import { PageRendererLive } from '@/infrastructure/layers/page-renderer-layer'
import { ServerFactoryLive } from '@/infrastructure/server/server-factory-live'
import { StaticSiteGeneratorLive } from '@/infrastructure/server/static-site-generator-live'
import type { Auth as AuthConfig } from '@/domain/models/app/auth'

/**
 * Application layer composition
 *
 * Combines all live service implementations into a single Layer
 * that can be provided to Application use cases.
 *
 * This is the production dependency wiring point - swap out
 * individual layers here for testing or different environments.
 *
 * @example
 * ```typescript
 * // In src/index.ts (production)
 * const program = startServer(appConfig).pipe(
 *   Effect.provide(createAppLayer(appConfig.auth))
 * )
 *
 * // In tests (with mocks)
 * const TestLayer = Layer.mergeAll(MockServerFactory, MockPageRenderer)
 * const program = startServer(appConfig).pipe(
 *   Effect.provide(TestLayer)
 * )
 * ```
 */
export const createAppLayer = (authConfig?: AuthConfig) =>
  Layer.mergeAll(
    createAuthLayer(authConfig),
    ServerFactoryLive,
    PageRendererLive,
    CSSCompilerLive,
    StaticSiteGeneratorLive,
    DevToolsLayerOptional
  )

/**
 * Default application layer with default auth configuration
 *
 * @deprecated Use createAppLayer(authConfig) instead for app-specific configuration
 */
export const AppLayer = createAppLayer()
