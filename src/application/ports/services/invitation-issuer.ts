/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type {
  InvitationAuthEngine,
  InvitationStore,
} from '@/application/ports/contracts/invitation-services'

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
