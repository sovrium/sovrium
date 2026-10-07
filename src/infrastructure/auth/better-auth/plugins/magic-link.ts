/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { magicLink } from 'better-auth/plugins'
import { getStrategy, hasStrategy } from '@/domain/models/app/auth'
import type { Auth } from '@/domain/models/app/auth'

/** A link's lifetime when the strategy leaves `expirationMinutes` unset. */
const DEFAULT_EXPIRATION_MINUTES = 15

/**
 * Build magic link plugin if enabled in auth configuration. The link lives as
 * long as the strategy's `expirationMinutes` (15 by default); the plugin reads
 * its lifetime in seconds.
 */
export const buildMagicLinkPlugin = (
  sendMagicLink: (data: {
    readonly user: { readonly email: string }
    readonly url: string
    readonly token: string
  }) => Promise<void>,
  authConfig?: Auth
) => {
  return hasStrategy(authConfig, 'magicLink')
    ? [
        magicLink({
          sendMagicLink: async ({ email, token, url }) =>
            sendMagicLink({ user: { email }, url, token }),
          disableSignUp: authConfig?.allowSignUp === false,
          expiresIn:
            (getStrategy(authConfig, 'magicLink')?.expirationMinutes ??
              DEFAULT_EXPIRATION_MINUTES) * 60,
        }),
      ]
    : []
}
