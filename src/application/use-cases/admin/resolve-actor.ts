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
 * `AuthRepository` is DECLARED rather than provided (standing rule E1). Every
 * caller is a route handler that already holds the request, so each runs this
 * on the services the server resolved at boot — one lookup pair per emit, on
 * the request's own fiber, inside the request's span. The error channel stays
 * open: an unreadable actor fails the emit exactly as it did when this ran its
 * own fiber and the rejection reached the handler.
 *
 * @public
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { coerceHumanActorRole } from '@/domain/models/api/admin/envelope/actor'
import type { AuthDatabaseError } from '@/application/ports/repositories/auth/auth-repository'
import type { Actor } from '@/domain/models/api/admin/envelope/actor'

const DEFAULT_ROLE = 'member'

/**
 * Resolve `userId` → canonical `Actor` block, suitable for emit.
 */
export const resolveActor = (
  userId: string
): Effect.Effect<Actor, AuthDatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const [role, email] = yield* Effect.all([
      repo.getUserRole(userId),
      repo.findUserEmailById(userId),
    ])

    // The audit-log Actor schema's `role` is the closed enum
    // `admin | operator | system`, while Sovrium roles are an open set, so a
    // coercion is unavoidable. It lives in the domain
    // (`coerceHumanActorRole`) rather than here so that EVERY human emit site
    // shares one mapping — see that function for why `system` is unreachable
    // for a session-backed caller.
    return {
      id: userId,
      type: 'user',
      role: coerceHumanActorRole(role ?? DEFAULT_ROLE),
      ...(email ? { email } : {}),
    } satisfies Actor
  }).pipe(Effect.withSpan('admin.resolve-actor'))
