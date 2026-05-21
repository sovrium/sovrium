/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AiServiceLive } from '@/infrastructure/ai/ai-service-live'
import { PackageResolverLive } from '@/infrastructure/automations/package-resolver'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics-repository-live'
import { AutomationDigestRepositoryLive } from '@/infrastructure/database/repositories/automation-digest-repository-live'
import { AutomationRepositoryLive } from '@/infrastructure/database/repositories/automation-repository-live'
import { AutomationRunRepositoryLive } from '@/infrastructure/database/repositories/automation-run-repository-live'
import { AutomationStateRepositoryLive } from '@/infrastructure/database/repositories/automation-state-repository-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connection-token-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { ImageTransformServiceLive } from '@/infrastructure/storage/image-transform-live'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'

export const AutomationRuntimeLayer = Layer.mergeAll(
  TableLive,
  AutomationRepositoryLive,
  AutomationRunRepositoryLive,
  AutomationStateRepositoryLive,
  AutomationDigestRepositoryLive,
  ConnectionRepositoryLive,
  ConnectionTokenRepositoryLive,
  PackageResolverLive,
  AiServiceLive,
  StorageServiceLive,
  ImageTransformServiceLive,
  AnalyticsRepositoryLive
)

export function provideAutomationRuntime<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AutomationRuntimeLayer) as Effect.Effect<A, E, never>
}
