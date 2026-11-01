/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  ConfigInvitationIssuer,
  InvitationKitError,
  type InvitationKit,
} from '@/application/ports/services/invitation-issuer'
import { mountedInvitationPages } from '@/domain/models/app/pages/invitation-link-service'
import { Database } from '@/infrastructure/database/drizzle/layer'

/**
 * Live `ConfigInvitationIssuer`: the invitation store, an engine built from the
 * app's auth config, and the app's own invitation mailer — the template, app
 * name and languages the console's invitation is sent with.
 *
 * The engine and mailer modules are loaded LAZILY, as
 * `ConfigAccountProvisionerLive` loads the engine: the automation handlers are
 * reachable from the cron scheduler at boot, and an app without `auth:` must
 * not pay for the Better Auth graph. Annotated for the reason
 * `InvitationIssuerLive` is: inferring it would make the engine name itself.
 */
export const ConfigInvitationIssuerLive: Layer.Layer<ConfigInvitationIssuer, never, Database> =
  Layer.effect(
    ConfigInvitationIssuer,
    Effect.map(Database, (database) =>
      ConfigInvitationIssuer.of({
        kitFor: (app) =>
          Effect.tryPromise({
            try: async (): Promise<InvitationKit> => {
              const [
                { createAuthInstance },
                { createInvitationServices },
                { createEmailHandlers },
                { adminMountsFor },
                { makeAuthHookPolicies },
              ] = await Promise.all([
                import('./auth'),
                import('./invitation-services'),
                import('./email-handlers'),
                import('@/infrastructure/server/admin-mounts'),
                import('@/infrastructure/server/auth-hook-policies'),
              ])
              const instance = createAuthInstance(app.auth, {
                policies: makeAuthHookPolicies(database),
                database,
              })
              return {
                services: createInvitationServices(instance, {
                  database,
                  linkPages: () => mountedInvitationPages(adminMountsFor(app)),
                }),
                mailer: createEmailHandlers(app.auth, app.name, undefined, app.languages),
              }
            },
            catch: (cause) => new InvitationKitError({ cause }),
          }).pipe(Effect.withSpan('auth.invitation-kit-from-config')),
      })
    )
  )
