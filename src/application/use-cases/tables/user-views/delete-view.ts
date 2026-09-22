/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Delete a saved view the caller owns.
 *
 * Phase 9 Cycle 5 — thin orchestrator over the `UserViewRepository` port.
 * Resolves to `void` on success; a non-deleting query (no row matched the
 * `(viewId, userId, tableName)` tuple) surfaces as `UserViewNotFoundError`
 * from the repository's live implementation.
 */

import { Effect } from 'effect'
import {
  UserViewRepository,
  type UserViewDbError,
  type UserViewNotFoundError,
} from '@/application/ports/repositories/tables/user-view-repository'

export interface DeleteUserViewInput {
  readonly userId: string
  readonly tableName: string
  readonly viewId: string
}

export const deleteUserView = (
  input: DeleteUserViewInput
): Effect.Effect<void, UserViewDbError | UserViewNotFoundError, UserViewRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserViewRepository
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- `repo.delete` is the port method; ownership scoping lives in the live impl's Drizzle `.where(...)`
    return yield* repo.delete(input)
  }).pipe(Effect.withSpan('tables.delete-user-view'))
