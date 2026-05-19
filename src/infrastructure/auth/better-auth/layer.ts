/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer } from 'effect'
import { AuthError } from '../../errors/auth-error'
import { createAuthInstance } from './auth'
import type { auth } from './auth'
import type { Auth as AuthConfig } from '@/domain/models/app/auth'

export { AuthError }

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
