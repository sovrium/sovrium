/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { InvitationIssuer } from '@/application/ports/services/invitation-issuer'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { Auth } from './auth-service'
import { createUserThrough, invitationStoreOver } from './invitation-services'

/**
 * Live `InvitationIssuer` over the Better Auth instance the app layer built:
 * the same invitation store the routes use, and that instance's account
 * creation. Built FROM `Auth`, so an app with no `auth:` block refuses on use
 * rather than crashing at boot. Annotated for the reason
 * `AccountProvisionerLive` is: inferring it would make `Auth` name itself.
 */
export const InvitationIssuerLive: Layer.Layer<InvitationIssuer, never, Auth | Database> =
  Layer.effect(
    InvitationIssuer,
    Effect.gen(function* () {
      const auth = yield* Auth
      const { client, dialect } = yield* Database
      return InvitationIssuer.of({
        store: invitationStoreOver(client, dialect.kind),
        engine: { createUser: (input) => createUserThrough(auth.api)(input) },
      })
    })
  )

/** {@link InvitationIssuerLive} bound to one auth layer; the composing root provides the `Database`. */
export const invitationIssuerFor = (
  authLayer: Layer.Layer<Auth, never, Database>
): Layer.Layer<InvitationIssuer, never, Database> => Layer.provide(InvitationIssuerLive, authLayer)
