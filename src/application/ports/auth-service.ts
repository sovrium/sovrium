/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { Effect } from 'effect'

/**
 * Service error returned by auth operations
 */
export type AuthServiceError = Readonly<{
  message: string
  status: number
}>

/**
 * Input for adding a member to an organization
 */
export type AddMemberParams = Readonly<{
  organizationId: string
  userId: string
  role?: 'owner' | 'admin' | 'member'
  headers: Headers
}>

/**
 * AuthService port for authentication-related operations
 *
 * This interface defines the contract for auth operations,
 * allowing the Application layer to remain decoupled from
 * Better Auth infrastructure implementation.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const authService = yield* AuthService
 *   const result = yield* authService.addMember({
 *     organizationId: 'org-123',
 *     userId: 'user-456',
 *     role: 'member',
 *     headers: new Headers(),
 *   })
 *   return result
 * })
 * ```
 */
export class AuthService extends Context.Tag('AuthService')<
  AuthService,
  {
    /**
     * Add a member to an organization
     *
     * Wraps Better Auth's SERVER_ONLY auth.api.addMember() function.
     * Allows authenticated organization owners/admins to add users
     * directly to their organization without invitation flow.
     *
     * @param params - Add member parameters with authentication headers
     * @returns Effect that yields member data or error
     */
    readonly addMember: (
      params: AddMemberParams
    ) => Effect.Effect<{ member: unknown }, AuthServiceError>
  }
>() {}
