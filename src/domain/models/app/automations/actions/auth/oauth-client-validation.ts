/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isNativeHttpLoopbackOrigin } from '@/domain/kernel/url/oauth-loopback'

/**
 * The one shape a sign-in client registered by `registerOAuthClient` takes,
 * and the rule its rendered return address must meet. Nothing here is
 * configurable: every other shape is a way to misuse such a client.
 */

/** The scopes the client may ask for, and nothing more. */
export const SIGN_IN_CLIENT_SCOPES: readonly string[] = ['openid', 'email', 'profile']

/**
 * Why `raw` cannot be a sign-in client's return address, or `undefined` when
 * it can: an absolute `https` URL — `http` on a loopback host only — with no
 * fragment and no credentials. The value is never echoed back.
 */
export const signInClientRedirectProblem = (raw: string): string | undefined => {
  const url = URL.parse(raw.trim())
  if (url === null) return 'is not an absolute URL'
  if (url.protocol !== 'https:' && !isNativeHttpLoopbackOrigin(url.origin))
    return 'must use https (http is allowed on a loopback host only)'
  if (url.hash !== '' || raw.includes('#')) return 'must not carry a fragment'
  if (url.username !== '' || url.password !== '') return 'must not carry credentials'
  return undefined
}
