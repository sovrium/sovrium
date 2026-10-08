/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { InvitationIssuer } from '@/application/ports/services/invitation-issuer'
import { Auth } from './auth-service'
import { createUserThrough, invitationStore } from './invitation-services'

/**
 * Live `InvitationIssuer` over the Better Auth instance the app layer built:
 * the same invitation store the routes use, and that instance's account
 * creation. Built FROM `Auth`, so an app with no `auth:` block refuses on use
 * rather than crashing at boot. Annotated for the reason
 * `AccountProvisionerLive` is: inferring it would make `Auth` name itself.
 */
export const InvitationIssuerLive: Layer.Layer<InvitationIssuer, never, Auth> = Layer.effect(
  InvitationIssuer,
  Effect.gen(function* () {
    const auth = yield* Auth
    return InvitationIssuer.of({
      store: invitationStore,
      engine: { createUser: (input) => createUserThrough(auth.api)(input) },
    })
  })
)

/** {@link InvitationIssuerLive} bound to one auth layer, its requirement discharged. */
export const invitationIssuerFor = (authLayer: Layer.Layer<Auth>): Layer.Layer<InvitationIssuer> =>
  Layer.provide(InvitationIssuerLive, authLayer)
