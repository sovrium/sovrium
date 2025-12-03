/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { getDefaultAuthInstance } from '@/infrastructure/auth/better-auth/auth'

/**
 * Organization Service
 *
 * Application layer service for organization member management.
 * Wraps Better Auth SERVER_ONLY endpoints that need to be exposed via HTTP.
 */

export type AddMemberInput = Readonly<{
  organizationId: string
  userId: string
  role?: 'owner' | 'admin' | 'member'
  headers: Headers
}>

export type AddMemberResult = Readonly<{
  member: unknown
}>

export type ServiceError = Readonly<{
  message: string
  status: number
}>

/**
 * Add member to organization
 *
 * Wraps Better Auth's SERVER_ONLY auth.api.addMember() function.
 * This allows authenticated organization owners/admins to add users
 * directly to their organization without invitation flow.
 *
 * @param input - Add member request data with authentication headers
 * @returns Effect that resolves to member data or error
 */
export const addMember = (input: AddMemberInput): Effect.Effect<AddMemberResult, ServiceError> =>
  Effect.gen(function* () {
    const auth = getDefaultAuthInstance()

    // Better Auth API returns the data directly (not a Response object)
    const data = yield* Effect.tryPromise({
      try: async () =>
        auth.api.addMember({
          body: {
            userId: input.userId,
            organizationId: input.organizationId,
            // Better Auth expects specific role types
            role: input.role ?? 'member',
          },
          headers: input.headers,
        }),
      catch: (error): ServiceError => ({
        message: error instanceof Error ? error.message : 'Failed to add member',
        status: 500,
      }),
    })

    return { member: data }
  })
