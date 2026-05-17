/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth-repository'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth-repository-live'

// Constants
const DEFAULT_ROLE = 'member'

/** Service shape for direct injection (used by tests to bypass Effect DI) */
export type AuthRoleService = {
  readonly getUserRole: (userId: string) => Promise<string | undefined>
}

/**
 * Retrieves the user's global role from the database
 *
 * Delegates to AuthRepository (infrastructure layer) for database access.
 * This application layer function provides a convenient async interface
 * for use in presentation layer middleware and routes.
 *
 * Role resolution:
 * 1. Fetch global user role from users table via AuthRepository
 * 2. Default: 'member'
 *
 * @param userId - The user ID to look up
 * @param service - Optional direct service injection (for unit tests).
 *   Uses plain Promises to avoid Effect module contamination in Bun's shared process.
 */
export async function getUserRole(userId: string, service?: AuthRoleService): Promise<string> {
  if (service) {
    const role = await service.getUserRole(userId)
    return role ?? DEFAULT_ROLE
  }

  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.getUserRole(userId)
  }).pipe(Effect.provide(AuthRepositoryLive))

  const role = await Effect.runPromise(program)

  return role ?? DEFAULT_ROLE
}

/**
 * Updates the user's global role in the database
 *
 * @param userId - The user ID to update
 * @param role - The new role to assign
 */
export async function updateUserRole(userId: string, role: string): Promise<void> {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    yield* repo.updateUserRole(userId, role)
  }).pipe(Effect.provide(AuthRepositoryLive))

  return Effect.runPromise(program)
}

/**
 * Retrieves the user's active session token from the database
 *
 * @param userId - The user ID to look up
 * @returns The raw session token, or undefined if no active session
 */
export async function getUserSessionToken(userId: string): Promise<string | undefined> {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.getUserSessionToken(userId)
  }).pipe(Effect.provide(AuthRepositoryLive))

  return await Effect.runPromise(program)
}
