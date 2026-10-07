/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { type Context } from 'hono'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { adminPlaneNeedsPasskey } from '@/domain/models/app/auth/passkeys-service'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'

/**
 * Whether the admin plane holds an admin-tier MCP credential off the admin-only
 * tools, because the app requires a passkey of its administrators
 * (`auth.passkeys.requireForAdmin`) and the credential does not prove one.
 *
 * The rule is the one every HTTP admin door applies (`adminPlaneNeedsPasskey`),
 * fed with how the credential's session was opened:
 *
 *  - an **API key** passes `sessionId: undefined`. A key records nothing about
 *    the session that minted it and outlives that session, so it never proves
 *    a passkey — exactly as the HTTP admin plane answers every key 404;
 *  - an **OAuth access token** passes its `sid`, the session that authorised
 *    it. The token proves a passkey while that session is a passkey session,
 *    and introspection already refuses it once the session is gone.
 *
 * With the requirement off this answers `false` without touching the database.
 * A failed lookup fails CLOSED — the caller is held, never admitted.
 */
export const isHeldForPasskey = async (
  c: Readonly<Context>,
  app: { readonly auth?: object },
  sessionId: string | undefined
): Promise<boolean> => {
  if (!adminPlaneNeedsPasskey(app, undefined)) return false
  if (sessionId === undefined) return true
  const lookup = Effect.gen(function* () {
    const authRepository = yield* AuthRepository
    return yield* authRepository.findSessionSignInMethod(sessionId)
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[mcp-auth] session sign-in method lookup failed', cause))
    ),
    // effect-swallow: an unreadable session proves nothing, so the caller is
    // held off the admin-only tools, the fail-closed answer. The cause is
    // logged above so the blip stays visible to the operator.
    Effect.orElseSucceed((): string | undefined => undefined)
  )
  return adminPlaneNeedsPasskey(app, await runDomainPromise(c as Context, lookup))
}
