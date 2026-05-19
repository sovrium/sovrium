/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { oauthProvider } from '@better-auth/oauth-provider'
import { jwt } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

export const buildOauthServerPlugin = (authConfig?: Auth) => {
  if (!authConfig) return []

  return [
    jwt(),
    oauthProvider({
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,

      accessTokenExpiresIn: 3600,
      refreshTokenExpiresIn: 30 * 24 * 3600,

      loginPage: '/login',
      consentPage: '/oauth/consent',

      silenceWarnings: {
        oauthAuthServerConfig: true,
        openidConfig: true,
      },
    }),
  ]
}
