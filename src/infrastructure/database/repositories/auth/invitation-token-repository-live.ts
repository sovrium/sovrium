/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import {
  InvitationTokenDatabaseError,
  InvitationTokenRepository,
} from '@/application/ports/repositories/auth/invitation-token-repository'
import { findInvitationToken } from '@/infrastructure/auth/better-auth/invitation-queries'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/** Wrap a DB promise, adapting failures to `InvitationTokenDatabaseError`. */
const wrap = makeDbWrap((cause) => new InvitationTokenDatabaseError({ cause }))

/**
 * Invitation-token read port, backed by the existing query module.
 *
 * It DELEGATES to `invitation-queries.ts` rather than re-spelling the SELECT,
 * and that is deliberate. The identifier prefix, the two `value` encodings a
 * row can carry, and the decode that tolerates both are one contract with a
 * dozen call sites; a second reader with its own copy of the prefix is exactly
 * how the enveloped rows would start resolving in one place and not the other.
 * This layer's job is to move the call across the layer boundary, not to own
 * the encoding.
 */
export const InvitationTokenRepositoryLive = Layer.succeed(InvitationTokenRepository, {
  findByToken: (token: string) => wrap(() => findInvitationToken(token)),
})
