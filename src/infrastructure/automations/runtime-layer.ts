/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AiServiceLive } from '@/infrastructure/ai/ai-service-live'
import { PackageResolverLive } from '@/infrastructure/automations/package-resolver'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics/analytics-repository-live'
import { AutomationApprovalRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-approval-repository-live'
import { AutomationDigestRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-digest-repository-live'
import { AutomationRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-repository-live'
import { AutomationRunRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-run-repository-live'
import { AutomationStateRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-state-repository-live'
import { CloudHostRegistryRepositoryLive } from '@/infrastructure/database/repositories/cloud/cloud-host-registry-repository-live'
import { CloudIngressRepositoryLive } from '@/infrastructure/database/repositories/cloud/cloud-ingress-repository-live'
import { CloudQuotaRepositoryLive } from '@/infrastructure/database/repositories/cloud/cloud-quota-repository-live'
import { CloudSupervisorRepositoryLive } from '@/infrastructure/database/repositories/cloud/cloud-supervisor-repository-live'
import { CloudTenantDatabasesRepositoryLive } from '@/infrastructure/database/repositories/cloud/cloud-tenant-databases-repository-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { ImageTransformServiceLive } from '@/infrastructure/storage/image-transform-live'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'

export const AutomationRuntimeLayer = Layer.mergeAll(
  TableLive,
  AutomationRepositoryLive,
  AutomationRunRepositoryLive,
  AutomationApprovalRepositoryLive,
  AutomationStateRepositoryLive,
  AutomationDigestRepositoryLive,
  CloudHostRegistryRepositoryLive,
  CloudIngressRepositoryLive,
  CloudQuotaRepositoryLive,
  CloudSupervisorRepositoryLive,
  CloudTenantDatabasesRepositoryLive,
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
