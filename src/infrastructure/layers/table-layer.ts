/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics-repository-live'
import { AutomationDigestRepositoryLive } from '@/infrastructure/database/repositories/automation-digest-repository-live'
import { AutomationRepositoryLive } from '@/infrastructure/database/repositories/automation-repository-live'
import { AutomationRunRepositoryLive } from '@/infrastructure/database/repositories/automation-run-repository-live'
import { AutomationStateRepositoryLive } from '@/infrastructure/database/repositories/automation-state-repository-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connection-token-repository-live'
import { UserAccessRepositoryLive } from '@/infrastructure/database/repositories/user-access-repository-live'
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
  AnalyticsRepositoryLive
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
