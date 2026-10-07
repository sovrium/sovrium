/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  AccountCreationError,
  AccountProvisioner,
} from '@/application/ports/services/account-provisioner'
import { Auth } from './auth-service'

/**
 * Live `AccountProvisioner` over the Better Auth instance the app layer built.
 *
 * Built FROM `Auth`, so it inherits that layer's no-auth behaviour: on an app
 * with no `auth:` block the stub refuses, and the refusal arrives here as an
 * {@link AccountCreationError} rather than a crash.
 *
 * The type is ANNOTATED, not inferred, and that is load-bearing: `Auth`'s shape
 * is derived from the Better Auth factory's return type, whose hooks reach the
 * server's composed layer, which names this layer. Inferring it would close
 * that loop and make `Auth` reference itself.
 */
export const AccountProvisionerLive: Layer.Layer<AccountProvisioner, never, Auth> = Layer.effect(
  AccountProvisioner,
  Effect.gen(function* () {
    const auth = yield* Auth
    return AccountProvisioner.of({
      createUser: (account) =>
        Effect.tryPromise({
          try: () =>
            auth.api.createUser({
              body: {
                email: account.email,
                password: account.password,
                name: account.name,
                // Better Auth types `role` as its built-in `'user' | 'admin'`
                // union, but the admin plugin accepts arbitrary app-defined roles.
                role: account.role as 'admin',
              },
            }),
          catch: (cause) => new AccountCreationError({ cause }),
        }).pipe(
          Effect.map((created) => ({
            userId: (created as { user?: { id?: string } } | undefined)?.user?.id,
          })),
          Effect.withSpan('auth.create-user')
        ),
    })
  })
)

/**
 * {@link AccountProvisionerLive} bound to one auth layer, with its requirement
 * already discharged. The composition root hands in the SAME `Auth` layer it
 * merges, so the provisioner and every other `Auth` consumer share one engine
 * (Effect memoises a layer by identity). Annotated for the reason above.
 */
export const accountProvisionerFor = (
  authLayer: Layer.Layer<Auth>
): Layer.Layer<AccountProvisioner> => Layer.provide(AccountProvisionerLive, authLayer)
