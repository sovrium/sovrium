/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { magicLink } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Build magic link plugin if enabled in auth configuration
 */
export const buildMagicLinkPlugin = (
  sendMagicLink: (data: {
    readonly user: { readonly email: string }
    readonly url: string
    readonly token: string
  }) => Promise<void>,
  authConfig?: Auth
) => {
  return authConfig?.magicLink
    ? [
        magicLink({
          sendMagicLink: async ({ email, token, url }) =>
            sendMagicLink({ user: { email }, url, token }),
        }),
      ]
    : []
}
