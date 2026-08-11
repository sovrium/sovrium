/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Create a saved view for the caller.
 *
 * Phase 9 Cycle 5 — thin orchestrator over the `UserViewRepository` port.
 * The unique-name collision → `UserViewConflictError` translation lives in
 * the repository's live implementation (HTTP 409 surface); this program only
 * forwards the validated payload.
 */

import { Effect } from 'effect'
import {
  UserViewRepository,
  type CreateUserViewInput,
  type UserViewConflictError,
  type UserViewDbError,
  type UserViewNotFoundError,
  type UserViewResponse,
} from '@/application/ports/repositories/tables/user-view-repository'

export const createUserView = (
  input: CreateUserViewInput
): Effect.Effect<
  UserViewResponse,
  UserViewConflictError | UserViewDbError | UserViewNotFoundError,
  UserViewRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UserViewRepository
    return yield* repo.create(input)
  })
