/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { createAuthLayer } from '@/infrastructure/auth/better-auth'
import { PackageResolverLive } from '@/infrastructure/automations/package-resolver'
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
import { TelemetryTracingLayerOptional } from '@/infrastructure/telemetry/telemetry-trace-layer'
import type { Auth as AuthConfig } from '@/domain/models/app/auth'

export const createAppLayer = (authConfig?: AuthConfig) => {
  const PageRendererWithDeps = PageRendererLive.pipe(Layer.provide(DataSourceRepositoryLive))

  return Layer.mergeAll(
    createAuthLayer(authConfig),
    DatabaseLive,
    ServerFactoryLive,
    PageRendererWithDeps,
    CSSCompilerLive,
    StaticSiteGeneratorLive,
    DevToolsLayerOptional,
    TelemetryTracingLayerOptional,
    LoggerLive,
    AuthRepositoryLive,
    StorageLive,
    PackageResolverLive,
    TypeScriptValidatorLive,
    CronSchedulerLive
  )
}

export const createStaticBuildLayer = () => {
  const PageRendererWithDeps = PageRendererLive.pipe(Layer.provide(DataSourceRepositoryLive))

  return Layer.mergeAll(
    ServerFactoryLive,
    PageRendererWithDeps,
    CSSCompilerLive,
    StaticSiteGeneratorLive,
    DevToolsLayerOptional,
    LoggerLive
  )
}
