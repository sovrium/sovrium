/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type {
  InvitationAuthEngine,
  InvitationMailer,
  InvitationServices,
  InvitationStore,
} from '@/application/ports/contracts/invitation-services'
import type { App } from '@/domain/models/app'

/**
 * What issuing an invitation needs: the invitation store, and the engine's
 * account creation — no mailer and no password hasher, because issuing writes
 * an account with no credential and a token, and sends nothing.
 */
export interface InvitationIssuingServices {
  readonly store: InvitationStore
  readonly engine: Pick<InvitationAuthEngine, 'createUser'>
}

/**
 * The invitation services for code that runs outside a request — a seed run
 * issuing the pending invitations its users file lists. The HTTP routes are
 * handed theirs by the composition root; this port carries the same store and
 * engine through the app layer.
 */
export class InvitationIssuer extends Context.Service<
  InvitationIssuer,
  InvitationIssuingServices
>()('InvitationIssuer') {}

/** The auth engine or its mailer could not be built for this app. `cause` is the error. */
export class InvitationKitError extends Data.TaggedError('InvitationKitError')<{
  readonly cause: unknown
}> {}

/** Everything an emailed invitation needs: the store and engine, and the mailer. */
export interface InvitationKit {
  readonly services: InvitationServices
  readonly mailer: InvitationMailer
}

/**
 * The emailed-invitation services for code that holds an app's CONFIG rather
 * than a running engine — the `auth/inviteUser` automation step, reachable from
 * the cron scheduler and the record-event dispatcher as well as from a request.
 * Like `ConfigAccountProvisioner`, the implementation builds the engine from the
 * config on demand, so a deployment without an `auth:` block never loads it.
 */
export class ConfigInvitationIssuer extends Context.Service<
  ConfigInvitationIssuer,
  {
    readonly kitFor: (app: Readonly<App>) => Effect.Effect<InvitationKit, InvitationKitError>
  }
>()('ConfigInvitationIssuer') {}
