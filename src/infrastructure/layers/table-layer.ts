/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, type Result } from 'effect'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics/analytics-repository-live'
import { UserAccessRepositoryLive } from '@/infrastructure/database/repositories/auth/user-access-repository-live'
import { AutomationDigestRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-digest-repository-live'
import { AutomationPauseRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-pause-repository-live'
import { AutomationRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-repository-live'
import { AutomationRunRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-run-repository-live'
import { AutomationStateRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-state-repository-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'
import { LinkRepositoryLive } from '@/infrastructure/database/repositories/links/link-repository-live'
import { DataSourceRepositoryLive } from '@/infrastructure/database/repositories/tables/data-source-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { ServerOriginLive } from '@/infrastructure/server/server-origin-live'

// Re-export infrastructure queries used by table route handlers
export { checkForExistingRecords } from '@/infrastructure/database/table-queries/query-helpers/check-existing-records'

/**
 * Composite layer for table routes that also dispatch record-event
 * automations. Provides TableLive plus the automation repositories
 * required by the engine's run loop:
 *   - AutomationRepository (lazy seed of `system.automation_definitions`)
 *   - AutomationRunRepository (persist runs + steps)
 *   - AutomationStateRepository, AutomationDigestRepository (action handlers)
 *   - ConnectionRepository, ConnectionTokenRepository (http/oauth handlers)
 *   - DataSourceRepository (GAP-J1: hydrate many-to-one relationship fields in
 *     the record-event trigger envelope by fetching the related row by id)
 *   - AutomationPauseRepository (the operational-pause read
 *     `triggerRecordEventAutomations` performs before matching, so a paused
 *     automation is filtered out of the dispatch set)
 *   - LinkRepository + ServerOrigin (the `link/*` handlers, which mint through
 *     the same use-cases the admin console does and hand back an absolute
 *     address)
 *
 * ── This is a SECOND composition of the automation runtime, and the
 *    divergence is load-bearing to know about ────────────────────────────────
 *
 * `AutomationRuntimeLayer` (infrastructure/automations/runtime-layer.ts) is the
 * other one, and it is strictly larger — it additionally carries
 * `AuthRepository`, `AutomationApprovalRepository`, `AiService`,
 * `StorageService` and `ImageTransformService`. A handler needing one of those
 * therefore works from a webhook or cron trigger and fails from a RECORD
 * trigger, which is a difference no type catches: `provideTableWithAutomations
 * Live` casts its result to `Effect<A, E, never>`, asserting that every
 * requirement is met rather than proving it, and `triggerRecordEventAutomations`
 * catches the resulting missing-service defect into a single log line. The two
 * lists want unifying; doing so is a refactor with its own blast radius, not a
 * line to add while passing through.
 *
 * Used by the record-create handler so a record write can fire matching
 * record-triggered automations in the same request without leaking
 * Effect.provide calls into the route layer.
 */
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
  AutomationPauseRepositoryLive,
  ServerOriginLive,
  // Built from `Database`, so provided rather than merged bare — the admin
  // route and `AutomationRuntimeLayer` compose it the same way.
  Layer.provide(LinkRepositoryLive, DatabaseLive)
)

/**
 * Composite layer for the user_access (Z-2) endpoints. The route is
 * mounted at `/api/tables/user_access/records` BEFORE the table-record
 * routes (different middleware chain), so it gets its own provider.
 */
const UserAccessLive = UserAccessRepositoryLive

/**
 * Run an Effect program with TableLive layer
 *
 * This utility consolidates the common pattern of providing TableLive, converting to a Result,
 * and running as Promise. It's used by all table-related route handlers.
 *
 * TableLive provides: TableRepository, BatchRepository, CommentRepository, ActivityRepository
 *
 * @param program - The Effect program to run (may require repository services from TableLive)
 * @returns Promise resolving to a Result (Failure for errors, Success for success)
 *
 * @example
 * const result = await runTableProgram(createCommentProgram({ session, tableId, content }))
 * if (result._tag === 'Failure') {
 *   return handleError(c, result.failure)
 * }
 * return c.json(result.success, 201)
 */
export async function runTableProgram<A, E, R>(
  program: Effect.Effect<A, E, R>
): Promise<Result.Result<A, E>> {
  // Type assertion: TableLive provides all required repositories, so remaining requirements are never
  const provided = Effect.provide(program, TableLive) as Effect.Effect<A, E, never>
  return Effect.runPromise(Effect.result(provided))
}

/**
 * Run an Effect program with the user_access layer (Z-2 multi-tenant
 * junction). Used by the user-access route handlers, which are mounted
 * outside the regular table-route middleware chain.
 */
export async function runUserAccessProgram<A, E, R>(
  program: Effect.Effect<A, E, R>
): Promise<Result.Result<A, E>> {
  const provided = Effect.provide(program, UserAccessLive) as Effect.Effect<A, E, never>
  return Effect.runPromise(Effect.result(provided))
}

/**
 * Provide TableLive layer to an Effect program
 *
 * This is a simpler utility for cases where the program will be passed to runEffect
 * (which handles the Result conversion and error handling itself).
 *
 * TableLive provides: TableRepository, BatchRepository, CommentRepository, ActivityRepository
 *
 * @param program - The Effect program to provide TableLive to (may require repository services from TableLive)
 * @returns Effect program with TableLive provided (requirements resolved)
 *
 * @example
 * return runEffect(c, provideTableLive(batchCreateProgram({ ... })), responseSchema, 201)
 */
export function provideTableLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  // Type assertion: TableLive provides all required repositories, so remaining requirements are never
  return Effect.provide(program, TableLive) as Effect.Effect<A, E, never>
}

/**
 * Provide TableLive + AutomationRepositories to an Effect program. Use this
 * when a table-route program also taps a record-triggered automation
 * (`triggerRecordEventAutomations`) — the record write and automation engine
 * run inside the same Effect request scope.
 */
export function provideTableWithAutomationsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, TableWithAutomationsLive) as Effect.Effect<A, E, never>
}
