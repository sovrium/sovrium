/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { CSSCompilerLive } from '@/infrastructure/css/css-compiler-live'
import { DevToolsLayerOptional } from '@/infrastructure/devtools'
import { ServerFactoryLive } from '@/infrastructure/server/server-factory-live'
import { StaticSiteGeneratorLive } from '@/infrastructure/server/static-site-generator-live'
import { PageRendererLive } from '@/presentation/layers/page-renderer-live'

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
 *   Effect.provide(AppLayer)
 * )
 *
 * // In tests (with mocks)
 * const TestLayer = Layer.mergeAll(MockServerFactory, MockPageRenderer)
 * const program = startServer(appConfig).pipe(
 *   Effect.provide(TestLayer)
 * )
 * ```
 */
export const AppLayer = Layer.mergeAll(
  ServerFactoryLive,
  PageRendererLive,
  CSSCompilerLive,
  StaticSiteGeneratorLive,
  DevToolsLayerOptional
)
