/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  AccountCreationError,
  ConfigAccountProvisioner,
} from '@/application/ports/services/account-provisioner'
import { Database } from '@/infrastructure/database/drizzle/layer'

/**
 * Live `ConfigAccountProvisioner`.
 *
 * The engine module is loaded LAZILY: the automation action handlers are
 * reachable from `registerCronAutomations` at boot, so a static import would
 * make every server — including the ones that declare no `auth:` block — pay
 * for the Better Auth graph. An app without auth never reaches this; one with
 * auth has already loaded the package through its own auth layer, so the
 * import resolves from cache.
 */
export const ConfigAccountProvisionerLive = Layer.effect(
  ConfigAccountProvisioner,
  Effect.map(Database, (database) =>
    ConfigAccountProvisioner.of({
      createUser: (authConfig, account) =>
        Effect.tryPromise({
          try: async () => {
            const [{ createAuthInstance }, { makeAuthHookPolicies }] = await Promise.all([
              import('./auth'),
              import('@/infrastructure/server/auth-hook-policies'),
            ])
            const instance = createAuthInstance(authConfig, {
              policies: makeAuthHookPolicies(database),
              database,
            })
            const created = await instance.api.createUser({
              body: {
                email: account.email,
                name: account.name,
                password: account.password,
                // Better Auth's plugin types insist on its closed union; Sovrium
                // permits the custom roles declared in `auth.roles[]`.
                ...(account.role ? { role: account.role as 'user' | 'admin' } : {}),
              },
            })
            return { userId: (created as { user?: { id?: string } } | undefined)?.user?.id }
          },
          catch: (cause) => new AccountCreationError({ cause }),
        }).pipe(Effect.withSpan('auth.create-user-from-config')),
    })
  )
)
