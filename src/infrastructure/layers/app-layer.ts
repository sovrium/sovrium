/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import {
  DesignKitAssetsLive,
  makeDesignKitAssetsLive,
} from '@/infrastructure/assets/design-kit-assets-live'
import { CSSCompilerLive } from '@/infrastructure/css/css-compiler-live'
import { DevToolsLayerOptional } from '@/infrastructure/devtools'
import {
  createAppServicesLayer,
  PageRendererWithDeps,
} from '@/infrastructure/layers/app-services-layer'
import { LoggerLive } from '@/infrastructure/logging/logger'
import { ContentDirReaderLive } from '@/infrastructure/markdown/content-dir-reader-live'
import { ServerFactoryLive } from '@/infrastructure/server/server-factory-live'
import { StaticSiteGeneratorLive } from '@/infrastructure/server/static-site-generator-live'
import type { Auth as AuthConfig } from '@/domain/models/app/auth'

/**
 * Application layer composition — the boot-time root.
 *
 * Every live service the application reads (`createAppServicesLayer`), plus
 * `ServerFactoryLive`, the adapter `startServer` and the static build use to
 * build a listener or a render app.
 *
 * The factory is added HERE rather than inside `createAppServicesLayer`
 * because the servers it builds own a domain runtime composed from that
 * services layer: naming it there would make the factory's module import
 * itself through the runtime. Keeping it at this level is what makes the
 * import graph one-directional — `app-layer` → `server-factory-live` →
 * `domain-runtime` → `app-services-layer`, and nothing back.
 *
 * @example
 * ```typescript
 * const program = startServer(appConfig).pipe(
 *   Effect.provide(createAppLayer(appConfig.auth))
 * )
 * ```
 */
export const createAppLayer = (authConfig?: AuthConfig) =>
  Layer.mergeAll(createAppServicesLayer(authConfig), ServerFactoryLive)

/**
 * Static build layer composition
 *
 * A minimal layer for static site generation that excludes database,
 * auth, and repository services. Static builds only need rendering
 * and CSS compilation — no database connection required.
 *
 * This prevents subprocess hangs when `build()` is called without
 * DATABASE_URL (e.g., in E2E tests or CI static generation).
 */
export const createStaticBuildLayer = Layer.mergeAll(
  // `ContentDirReader` — the Markdown twins and the page-search corpus read the
  // content directories through it.
  ContentDirReaderLive,
  ServerFactoryLive,
  PageRendererWithDeps,
  CSSCompilerLive,
  // `DesignKitAssets` — the files `sovrium design-system --format bundle` copies.
  DesignKitAssetsLive,
  StaticSiteGeneratorLive,
  DevToolsLayerOptional,
  LoggerLive
)

/**
 * The static-build layer for the design-system bundle: the same services, with
 * the bundle's files able to read the app's public directory (its logo).
 *
 * @param publicDir - the directory the app's public files sit in, if any.
 */
export const createDesignBundleLayer = (publicDir: string | undefined) =>
  Layer.merge(createStaticBuildLayer, makeDesignKitAssetsLive(publicDir))
