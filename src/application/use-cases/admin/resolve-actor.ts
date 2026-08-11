/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve a user session to the canonical audit-log `Actor` block.
 *
 * Reads role + email from the auth repository and returns the
 * `{ id, type, role, email? }` shape used by every audit-log emit. The
 * `type` is always `'user'` for session-backed callers; system / api-token
 * / automation actors construct their own Actor blocks.
 *
 * @public
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { coerceHumanActorRole } from '@/domain/models/api/admin/_shared/actor'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import type { Actor } from '@/domain/models/api/admin/_shared/actor'

const DEFAULT_ROLE = 'member'

/**
 * Resolve `userId` → canonical `Actor` block, suitable for emit.
 */
export async function resolveActor(userId: string): Promise<Actor> {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    const [role, email] = yield* Effect.all([
      repo.getUserRole(userId),
      repo.findUserEmailById(userId),
    ])
    return { role: role ?? DEFAULT_ROLE, email }
  }).pipe(Effect.provide(AuthRepositoryLive))

  const { role, email } = await Effect.runPromise(program)

  // The audit-log Actor schema's `role` is the closed enum
  // `admin | operator | system`, while Sovrium roles are an open set, so a
  // coercion is unavoidable. It lives in the domain
  // (`coerceHumanActorRole`) rather than here so that EVERY human emit site
  // shares one mapping — see that function for why `system` is unreachable
  // for a session-backed caller.
  return {
    id: userId,
    type: 'user',
    role: coerceHumanActorRole(role),
    ...(email ? { email } : {}),
  }
}
