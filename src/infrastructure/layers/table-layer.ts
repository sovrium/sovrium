/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, type Layer, type Result } from 'effect'
import { AutomationRuntimeLayer } from '@/infrastructure/automations/runtime-layer'
import { UserAccessRepositoryLive } from '@/infrastructure/database/repositories/auth/user-access-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'

/**
 * The services `TableLive` builds — `TableRepository`, `BatchRepository`,
 * `CommentRepository`, `ActivityRepository`.
 *
 * Exported so a caller that RUNS a provided program can pin its requirement
 * channel to exactly this set instead of asserting it away.
 */
export type TableServices = Layer.Success<typeof TableLive>

// Re-export infrastructure queries used by table route handlers
export { checkForExistingRecords } from '@/infrastructure/database/table-queries/query-helpers/check-existing-records'

/**
 * The composite layer for table routes that also dispatch record-event
 * automations — now simply the automation runtime itself.
 *
 * It used to be a SECOND, smaller composition maintained beside
 * `AutomationRuntimeLayer`, and the divergence was a live bug: the twin left
 * out `AuthRepository`, `AutomationApprovalRepository`, `AiService`,
 * `StorageService` and `ImageTransformService`, so an automation step reaching
 * for one of those ran from a webhook or cron trigger and failed from a RECORD
 * trigger. Nothing caught it, because this module asserted the provided program
 * had no requirements left rather than proving it, and
 * `triggerRecordEventAutomations` folded the resulting missing-service defect
 * into one log line. With the assertion removed the compiler reports the gap,
 * and the fix is to stop maintaining two lists: a record write now carries
 * exactly the services a cron or webhook run carries.
 */
const TableWithAutomationsLive = AutomationRuntimeLayer

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
export async function runTableProgram<A, E>(
  program: Effect.Effect<A, E, TableServices>
): Promise<Result.Result<A, E>> {
  // The requirement channel is PINNED to what `TableLive` builds rather than
  // being generic and then asserted away. Effect's R channel is covariant, so a
  // program needing a SUBSET of these services still fits, while one reaching
  // for a service this layer does not build fails to compile at the call site
  // instead of dying as a missing-service defect at runtime.
  const provided = Effect.provide(program, TableLive)
  return Effect.runPromise(Effect.result(provided))
}

/**
 * Run an Effect program with the user_access layer (Z-2 multi-tenant
 * junction). Used by the user-access route handlers, which are mounted
 * outside the regular table-route middleware chain.
 */
export async function runUserAccessProgram<A, E>(
  program: Effect.Effect<A, E, Layer.Success<typeof UserAccessLive>>
): Promise<Result.Result<A, E>> {
  const provided = Effect.provide(program, UserAccessLive)
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
export function provideTableLive<A, E, R>(program: Effect.Effect<A, E, R>) {
  // Type assertion: TableLive provides all required repositories, so remaining requirements are never
  return Effect.provide(program, TableLive)
}

/**
 * Provide TableLive + AutomationRepositories to an Effect program. Use this
 * when a table-route program also taps a record-triggered automation
 * (`triggerRecordEventAutomations`) — the record write and automation engine
 * run inside the same Effect request scope.
 */
export function provideTableWithAutomationsLive<A, E, R>(program: Effect.Effect<A, E, R>) {
  return Effect.provide(program, TableWithAutomationsLive)
}
