/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { magicLink } from 'better-auth/plugins'
import { hasStrategy } from '@/domain/models/app/auth'
import { magicLinkExpirationMinutes } from '@/domain/models/app/auth/magic-link-lifetime-service'
import { isMagicLinkSignUpOpen } from '@/domain/models/app/auth/sign-up-service'
import { runAuthTaskInBackground } from '../auth-background-tasks'
import type { Auth } from '@/domain/models/app/auth'

/** The slice of the endpoint context the sender reads to find an account. */
interface MagicLinkSendContext {
  readonly context: {
    readonly internalAdapter: {
      readonly findUserByEmail: (email: string) => Promise<unknown>
    }
  }
}

/**
 * Whether a link may go to `email`. While magic-link sign-up is closed, an
 * address with no account gets nothing; the endpoint still answers the same
 * neutral success, so the answer never tells whether an account exists.
 */
const mayReceiveLink = async (
  signUpOpen: boolean,
  email: string,
  ctx: MagicLinkSendContext | undefined
): Promise<boolean> => {
  if (signUpOpen) return true
  // No endpoint context means no way to check: fail closed.
  if (ctx === undefined) return false
  const found = await ctx.context.internalAdapter.findUserByEmail(email)
  return found !== null && found !== undefined
}

/** What the link sender mails: the address, the link and its token. */
type LinkMailer = (data: {
  readonly user: { readonly email: string }
  readonly url: string
  readonly token: string
}) => Promise<void>

/**
 * The plugin's `sendMagicLink`: checks the address may receive a link, then
 * hands the mail to `runInBackground` rather than waiting for it. Waiting would
 * make the answer for an address with an account slower than the answer for
 * one without, which sends nothing; both now answer once the check is done.
 */
export const linkSender =
  (
    sendMagicLink: LinkMailer,
    signUpOpen: boolean,
    runInBackground: (task: Promise<unknown>) => void = runAuthTaskInBackground
  ) =>
  async (
    { email, token, url }: { readonly email: string; readonly token: string; readonly url: string },
    ctx?: MagicLinkSendContext
  ): Promise<void> => {
    if (!(await mayReceiveLink(signUpOpen, email, ctx))) return
    runInBackground(sendMagicLink({ user: { email }, url, token }))
  }

/**
 * Build magic link plugin if enabled in auth configuration. The link lives as
 * long as the strategy's `expirationMinutes` (15 by default); the plugin reads
 * its lifetime in seconds.
 *
 * Sign-up by link follows the strategy's own `allowSignUp`, then
 * `auth.allowSignUp`, then closed. While closed, the plugin refuses to create
 * an account at verification, and the sender sends no link to an address with
 * no account in the first place.
 */
export const buildMagicLinkPlugin = (sendMagicLink: LinkMailer, authConfig?: Auth) => {
  const signUpOpen = isMagicLinkSignUpOpen(authConfig)
  return hasStrategy(authConfig, 'magicLink')
    ? [
        magicLink({
          sendMagicLink: linkSender(sendMagicLink, signUpOpen),
          disableSignUp: !signUpOpen,
          // The database keeps a hash of the link's token, never the token.
          storeToken: 'hashed',
          expiresIn: magicLinkExpirationMinutes(authConfig) * 60,
        }),
      ]
    : []
}
