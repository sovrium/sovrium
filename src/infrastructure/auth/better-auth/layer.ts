/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer } from 'effect'
import { AuthService, type AddMemberParams } from '@/application/ports/auth-service'
import { AuthError } from '../../errors/auth-error'
import { auth } from './auth'

// Re-export AuthError for convenience
export { AuthError }

/**
 * Auth Effect Context
 *
 * Provides authentication service for dependency injection in Effect programs.
 * Use this in Application layer to access authentication without direct imports.
 *
 * Implementation uses Better Auth library internally.
 *
 * @example
 * ```typescript
 * const protectedProgram = Effect.gen(function* () {
 *   const authService = yield* Auth
 *   const session = yield* authService.requireSession(headers)
 *   return { userId: session.user.id, email: session.user.email }
 * })
 * ```
 */
export class Auth extends Context.Tag('Auth')<
  Auth,
  {
    readonly api: typeof auth.api
    readonly getSession: (
      headers: Headers
    ) => Effect.Effect<Awaited<ReturnType<typeof auth.api.getSession>>, AuthError>
    readonly requireSession: (
      headers: Headers
    ) => Effect.Effect<NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>, AuthError>
  }
>() {}

/**
 * Live Auth Layer
 *
 * Provides the production authentication service with Effect-wrapped methods.
 * Implementation uses Better Auth library internally.
 */
export const AuthLive = Layer.succeed(
  Auth,
  Auth.of({
    api: auth.api,

    getSession: (headers) =>
      Effect.tryPromise({
        try: () => auth.api.getSession({ headers }),
        catch: (error) => new AuthError(error),
      }),

    requireSession: (headers) =>
      Effect.gen(function* () {
        const session = yield* Effect.tryPromise({
          try: () => auth.api.getSession({ headers }),
          catch: (error) => new AuthError(error),
        })

        if (!session) {
          return yield* Effect.fail(new AuthError('Unauthorized'))
        }

        return session
      }),
  })
)

/**
 * Live AuthService Layer
 *
 * Provides the production implementation of the AuthService port
 * for the Application layer. This adapter wraps Better Auth operations
 * to comply with the ports and adapters architecture.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const authService = yield* AuthService
 *   const result = yield* authService.addMember({ ... })
 *   return result
 * }).pipe(Effect.provide(AuthServiceLive))
 * ```
 */
export const AuthServiceLive = Layer.succeed(
  AuthService,
  AuthService.of({
    addMember: (params: AddMemberParams) =>
      Effect.tryPromise({
        try: async () => {
          // Import Drizzle and schema for direct database access
          const { db } = await import('@/infrastructure/database')
          const { members } = await import('./schema')

          // Generate member ID (Better Auth pattern: nanoid)
          const { nanoid } = await import('nanoid')
          const memberId = nanoid()

          // Insert member directly into database
          const [newMember] = await db
            .insert(members)
            .values({
              id: memberId,
              userId: params.userId,
              organizationId: params.organizationId,
              role: params.role ?? 'member',
            })
            .returning()

          return { member: newMember }
        },
        catch: (error) => ({
          message: error instanceof Error ? error.message : 'Failed to add member',
          status: 500,
        }),
      }),
  })
)
