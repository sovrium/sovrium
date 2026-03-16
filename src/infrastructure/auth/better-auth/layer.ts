/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer } from 'effect'
import { AuthError } from '../../errors/auth-error'
import { createAuthInstance } from './auth'
import type { auth } from './auth'
import type { Auth as AuthConfig } from '@/domain/models/app/auth'

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
    readonly api: ReturnType<typeof createAuthInstance>['api']
    readonly handler: ReturnType<typeof createAuthInstance>['handler']
    readonly getSession: (
      headers: Headers
    ) => Effect.Effect<Awaited<ReturnType<typeof auth.api.getSession>>, AuthError>
    readonly requireSession: (
      headers: Headers
    ) => Effect.Effect<NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>, AuthError>
  }
>() {}

/**
 * Create an Auth Layer with a specific auth configuration
 *
 * This allows us to create an Auth layer with app-specific configuration
 * (e.g., with admin plugin enabled) instead of using the default instance.
 *
 * @param authConfig - Optional auth configuration from app schema
 * @returns Layer providing Auth service with the specified configuration
 */
export const createAuthLayer = (authConfig?: AuthConfig): Layer.Layer<Auth> => {
  const authInstance = createAuthInstance(authConfig)

  return Layer.succeed(
    Auth,
    Auth.of({
      api: authInstance.api,
      handler: authInstance.handler,

      getSession: (headers) =>
        Effect.tryPromise({
          try: () => authInstance.api.getSession({ headers }),
          catch: (error) => new AuthError(error),
        }),

      requireSession: (headers) =>
        Effect.gen(function* () {
          const session = yield* Effect.tryPromise({
            try: () => authInstance.api.getSession({ headers }),
            catch: (error) => new AuthError(error),
          })

          if (!session) {
            return yield* Effect.fail(new AuthError('Unauthorized'))
          }

          return session
        }),
    })
  )
}

/**
 * Live Auth Layer
 *
 * Provides the production authentication service with Effect-wrapped methods.
 * Implementation uses Better Auth library internally with default configuration.
 *
 * @deprecated Use createAuthLayer(authConfig) instead for app-specific configuration
 */
export const AuthLive = createAuthLayer()
