/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { PackageResolverLive } from '@/infrastructure/automations/package-resolver'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics/analytics-repository-live'
import { UserAccessRepositoryLive } from '@/infrastructure/database/repositories/auth/user-access-repository-live'
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
import { DataSourceRepositoryLive } from '@/infrastructure/database/repositories/tables/data-source-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'

export { checkForExistingRecords } from '@/infrastructure/database/table-queries/query-helpers/check-existing-records'

const TableWithAutomationsLive = Layer.mergeAll(
  TableLive,
  AutomationRepositoryLive,
  AutomationRunRepositoryLive,
  AutomationStateRepositoryLive,
  AutomationDigestRepositoryLive,
  ConnectionRepositoryLive,
  ConnectionTokenRepositoryLive,
  AnalyticsRepositoryLive,
  DataSourceRepositoryLive,
  PackageResolverLive,
  CloudHostRegistryRepositoryLive,
  CloudIngressRepositoryLive,
  CloudQuotaRepositoryLive,
  CloudSupervisorRepositoryLive,
  CloudTenantDatabasesRepositoryLive
)

const UserAccessLive = UserAccessRepositoryLive

export async function runTableProgram<A, E, R>(
  program: Effect.Effect<A, E, R>
): Promise<
  { readonly _tag: 'Left'; readonly left: E } | { readonly _tag: 'Right'; readonly right: A }
> {
  const provided = Effect.provide(program, TableLive) as Effect.Effect<A, E, never>
  return Effect.runPromise(Effect.either(provided))
}

export async function runUserAccessProgram<A, E, R>(
  program: Effect.Effect<A, E, R>
): Promise<
  { readonly _tag: 'Left'; readonly left: E } | { readonly _tag: 'Right'; readonly right: A }
> {
  const provided = Effect.provide(program, UserAccessLive) as Effect.Effect<A, E, never>
  return Effect.runPromise(Effect.either(provided))
}

export function provideTableLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, TableLive) as Effect.Effect<A, E, never>
}

export function provideTableWithAutomationsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, TableWithAutomationsLive) as Effect.Effect<A, E, never>
}
