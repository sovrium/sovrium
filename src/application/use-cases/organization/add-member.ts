/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  AuthService,
  type AddMemberParams,
  type AuthServiceError,
} from '@/application/ports/auth-service'

/**
 * Organization Service
 *
 * Application layer service for organization member management.
 * Uses AuthService port for dependency injection, allowing the
 * Application layer to remain decoupled from infrastructure.
 */

export type AddMemberInput = AddMemberParams

export type AddMemberResult = Readonly<{
  member: unknown
}>

export type ServiceError = AuthServiceError

/**
 * Add member to organization
 *
 * Uses the AuthService port to delegate to Better Auth's
 * SERVER_ONLY auth.api.addMember() function.
 * This allows authenticated organization owners/admins to add users
 * directly to their organization without invitation flow.
 *
 * @param input - Add member request data with authentication headers
 * @returns Effect that resolves to member data or error (requires AuthService)
 */
export const addMember = (
  input: AddMemberInput
): Effect.Effect<AddMemberResult, ServiceError, AuthService> =>
  Effect.gen(function* () {
    const authService = yield* AuthService
    return yield* authService.addMember(input)
  })
