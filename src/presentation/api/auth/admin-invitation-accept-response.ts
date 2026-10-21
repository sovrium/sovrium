/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The response to an accepted invitation: the account, the session Better Auth
 * minted for it, and where the account lands in the app when its role cannot
 * open the console.
 */

import { inviteeAppLanding } from '@/domain/models/app/auth/invitee-landing-service'
import { logError } from '@/infrastructure/logging/logger'
import type { AcceptInvitationSuccess } from '@/application/use-cases/auth/admin-invitation'
import type { Auth } from '@/domain/models/app/auth'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

interface AcceptedInvitationUser {
  readonly id: string
  readonly email: string
  readonly name: string
}

/**
 * Where the account lands in the app, when its role cannot open the console:
 * `landingPath` is present exactly then. A page sending the invitee into the
 * console follows it instead, so nobody joins onto a console 404.
 */
type AcceptLanding = { readonly landingPath?: string }

/**
 * Forward `Set-Cookie` headers from the Better Auth sign-in response onto a
 * fresh response carrying our own JSON body.
 *
 * Better Auth's `asResponse: true` mode returns a `Response` whose body we
 * don't want (it is the standard sign-in payload), but whose cookies we
 * absolutely DO want — they carry the customer's freshly-minted session.
 */
const buildResponseWithForwardedCookies = (
  signInResponse: Readonly<Response>,
  user: AcceptedInvitationUser,
  landing: AcceptLanding
): Response => {
  const responseBody = {
    user: { id: user.id, email: user.email, name: user.name },
    status: 'accepted',
    ...landing,
  }
  const headers = new Headers({ 'content-type': 'application/json' })
  signInResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      headers.append('set-cookie', value)
    }
  })
  return new Response(JSON.stringify(responseBody), { status: 200, headers })
}

/**
 * Sign the freshly-onboarded customer in by delegating to Better Auth.
 *
 * If Better Auth surfaces an error (rare — the password was just set), we
 * soft-fail to a 200 with `sessionEstablished: false` so the customer can
 * proceed via the regular sign-in form rather than seeing a 500.
 */
export const buildPostAcceptResponse = async (
  authInstance: AuthInstance,
  accepted: AcceptInvitationSuccess,
  password: string,
  authConfig: Auth | undefined
): Promise<Response> => {
  const { user } = accepted
  const landingPath = inviteeAppLanding(accepted.role, { auth: authConfig })
  const landing: AcceptLanding = landingPath === undefined ? {} : { landingPath }
  try {
    const signInResponse = (await authInstance.api.signInEmail({
      body: { email: user.email, password, rememberMe: false },
      asResponse: true,
    })) as Response
    return buildResponseWithForwardedCookies(signInResponse, user, landing)
  } catch (error) {
    logError('[admin-invitation] post-accept sign-in failed', error)
    return new Response(
      JSON.stringify({
        user: { id: user.id, email: user.email, name: user.name },
        status: 'accepted',
        sessionEstablished: false,
        ...landing,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }
}
