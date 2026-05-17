/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AutomationDigestRepositoryLive } from '@/infrastructure/database/repositories/automation-digest-repository-live'
import { AutomationRepositoryLive } from '@/infrastructure/database/repositories/automation-repository-live'
import { AutomationRunRepositoryLive } from '@/infrastructure/database/repositories/automation-run-repository-live'
import { AutomationStateRepositoryLive } from '@/infrastructure/database/repositories/automation-state-repository-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connection-token-repository-live'
import { UserAccessRepositoryLive } from '@/infrastructure/database/repositories/user-access-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { NotificationsLive } from '@/infrastructure/notifications/layer'

// Re-export infrastructure queries used by table route handlers
export { checkForExistingRecords } from '@/infrastructure/database/table-queries/query-helpers/check-existing-records'

/**
 * Composite layer for table routes that also dispatch notifications
 * (e.g. record-create with the recordCreated trigger). Keeps the
 * notification dependency resolution centralized at the composition root
 * rather than scattering Effect.provide calls across handler files.
 */
const TableWithNotificationsLive = Layer.mergeAll(TableLive, NotificationsLive)

/**
 * Composite layer for table routes that also dispatch record-event
 * automations. Provides everything `TableWithNotificationsLive` does plus
 * the automation repositories required by the engine's run loop:
 *   - AutomationRepository (lazy seed of `system.automation_definitions`)
 *   - AutomationRunRepository (persist runs + steps)
 *   - AutomationStateRepository, AutomationDigestRepository (action handlers)
 *   - ConnectionRepository, ConnectionTokenRepository (http/oauth handlers)
 *
 * Used by the record-create handler so a record write can fire matching
 * record-triggered automations in the same request without leaking
 * Effect.provide calls into the route layer.
 */
const TableWithNotificationsAndAutomationsLive = Layer.mergeAll(
  TableLive,
  NotificationsLive,
  AutomationRepositoryLive,
  AutomationRunRepositoryLive,
  AutomationStateRepositoryLive,
  AutomationDigestRepositoryLive,
  ConnectionRepositoryLive,
  ConnectionTokenRepositoryLive
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
 * This utility consolidates the common pattern of providing TableLive, converting to Either,
 * and running as Promise. It's used by all table-related route handlers.
 *
 * TableLive provides: TableRepository, BatchRepository, CommentRepository, ActivityRepository
 *
 * @param program - The Effect program to run (may require repository services from TableLive)
 * @returns Promise resolving to Either (Left for errors, Right for success)
 *
 * @example
 * const result = await runTableProgram(createCommentProgram({ session, tableId, content }))
 * if (result._tag === 'Left') {
 *   return handleError(c, result.left)
 * }
 * return c.json(result.right, 201)
 */
export async function runTableProgram<A, E, R>(
  program: Effect.Effect<A, E, R>
): Promise<
  { readonly _tag: 'Left'; readonly left: E } | { readonly _tag: 'Right'; readonly right: A }
> {
  // Type assertion: TableLive provides all required repositories, so remaining requirements are never
  const provided = Effect.provide(program, TableLive) as Effect.Effect<A, E, never>
  return Effect.runPromise(Effect.either(provided))
}

/**
 * Run an Effect program with the user_access layer (Z-2 multi-tenant
 * junction). Used by the user-access route handlers, which are mounted
 * outside the regular table-route middleware chain.
 */
export async function runUserAccessProgram<A, E, R>(
  program: Effect.Effect<A, E, R>
): Promise<
  { readonly _tag: 'Left'; readonly left: E } | { readonly _tag: 'Right'; readonly right: A }
> {
  const provided = Effect.provide(program, UserAccessLive) as Effect.Effect<A, E, never>
  return Effect.runPromise(Effect.either(provided))
}

/**
 * Provide TableLive layer to an Effect program
 *
 * This is a simpler utility for cases where the program will be passed to runEffect
 * (which handles the Either conversion and error handling itself).
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
 * Provide TableLive + NotificationsLive layers to an Effect program.
 *
 * Use this when a table-route program also yields notification ports
 * (e.g. composing `notifyRecordCreated` into a record-create flow).
 *
 * @example
 * return runEffect(
 *   c,
 *   provideTableWithNotificationsLive(
 *     createRecordProgram(...).pipe(Effect.tap(record => notifyRecordCreated(...)))
 *   ),
 *   responseSchema,
 *   201
 * )
 * @public
 */
export function provideTableWithNotificationsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, TableWithNotificationsLive) as Effect.Effect<A, E, never>
}

/**
 * Provide TableLive + NotificationsLive + AutomationRepositories to an
 * Effect program. Use this when a table-route program also taps a
 * record-triggered automation (`triggerRecordEventAutomations`) — the
 * record write, notification dispatch, and automation engine all run
 * inside the same Effect request scope.
 */
export function provideTableWithNotificationsAndAutomationsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, TableWithNotificationsAndAutomationsLive) as Effect.Effect<
    A,
    E,
    never
  >
}
