/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableLive } from '@/infrastructure/database/table-live-layers'

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
  | { readonly _tag: 'Left'; readonly left: E }
  | { readonly _tag: 'Right'; readonly right: A }
> {
  // Type assertion: TableLive provides all required repositories, so remaining requirements are never
  const provided = Effect.provide(program, TableLive) as Effect.Effect<A, E, never>
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
