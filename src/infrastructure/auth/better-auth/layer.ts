/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AuthError } from '../../errors/auth-error'
import { createAuthInstance } from './auth'
import { Auth } from './auth-service'
import type { Auth as AuthConfig } from '@/domain/models/app/auth'

// Re-export AuthError for convenience
export { AuthError }

/**
 * Re-exported so `import { Auth, createAuthLayer } from './layer'` keeps
 * working for the callers that need both.
 *
 * The tag itself now lives in `./auth-service`, which is loadable WITHOUT the
 * `better-auth` package. Importing THIS module pulls `./auth` and with it the
 * entire Better Auth graph, so anything that needs only the tag — the app
 * layer, the bootstrap use-cases — must import it from `./auth-service`
 * instead. See `NoAuthLayer` there for why the split exists.
 */
export { Auth }

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
