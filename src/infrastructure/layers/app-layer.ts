/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { createAuthLayer } from '@/infrastructure/auth/better-auth'
import { TypeScriptValidatorLive } from '@/infrastructure/automations/typescript-validator'
import { CSSCompilerLive } from '@/infrastructure/css/css-compiler-live'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { DataSourceRepositoryLive } from '@/infrastructure/database/repositories/tables/data-source-repository-live'
import { DevToolsLayerOptional } from '@/infrastructure/devtools'
import { PageRendererLive } from '@/infrastructure/layers/page-renderer-layer'
import { LoggerLive } from '@/infrastructure/logging/logger'
import { CronSchedulerLive } from '@/infrastructure/scheduling/cron-scheduler-live'
import { ServerFactoryLive } from '@/infrastructure/server/server-factory-live'
import { StaticSiteGeneratorLive } from '@/infrastructure/server/static-site-generator-live'
import { StorageLive } from '@/infrastructure/storage/layer'
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
 * // In src/cli/index.ts (CLI entry point)
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
export const createAppLayer = (authConfig?: AuthConfig) => {
  // PageRendererLive requires DataSourceRepository — provide it
  const PageRendererWithDeps = PageRendererLive.pipe(Layer.provide(DataSourceRepositoryLive))

  return Layer.mergeAll(
    createAuthLayer(authConfig),
    DatabaseLive,
    ServerFactoryLive,
    PageRendererWithDeps,
    CSSCompilerLive,
    StaticSiteGeneratorLive,
    DevToolsLayerOptional,
    // NOTE: OTel trace export is NOT wired here. It moved to the pre-built unified
    // observability runtime (`observability-runtime.ts`), armed by
    // OTEL_EXPORTER_OTLP_TRACES_ENDPOINT and disposed on shutdown — the app-layer
    // scope closes right after boot, so a scoped tracer wired here would be
    // finalized before it ever exported a span. See
    // [internal ref].
    LoggerLive,
    AuthRepositoryLive,
    StorageLive,
    TypeScriptValidatorLive,
    // Currently unused at the AppLayer scope: the only consumer
    // (`registerCronAutomations`) self-provides `CronSchedulerLive` so it can
    // be invoked outside the `Effect.provide(createAppLayer(...))` boundary
    // (called from `createServer` directly, not from a use-case). Wired here
    // anyway so future callers that yield `CronScheduler` from inside an
    // app-layer-provided program see the live adapter without extra wiring.
    CronSchedulerLive
  )
}

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
// PageRendererLive requires DataSourceRepository — provide it.
// Static builds may not have DATABASE_URL, so the live implementation
// gracefully returns empty results when no database is available.
const PageRendererWithDeps = PageRendererLive.pipe(Layer.provide(DataSourceRepositoryLive))

export const createStaticBuildLayer = Layer.mergeAll(
  ServerFactoryLive,
  PageRendererWithDeps,
  CSSCompilerLive,
  StaticSiteGeneratorLive,
  DevToolsLayerOptional,
  LoggerLive
)
