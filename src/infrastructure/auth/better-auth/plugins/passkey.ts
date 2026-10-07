/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Must stay first: the compiled binary needs the polyfill installed before the
// passkey package's dependency graph initialises (see that module's comment).
import './reflect-metadata-polyfill'
import { passkey } from '@better-auth/passkey'
import { createAuthMiddleware } from 'better-auth/api'
import { loopbackRequestOrigin } from './loopback-origin'
import type { Auth } from '@/domain/models/app/auth'

/** The endpoint whose sessions a passkey opened. */
export const PASSKEY_SIGN_IN_PATH = '/passkey/verify-authentication'

/** The origin of `BASE_URL`, or `undefined` when it is unset or does not parse. */
const baseUrlOrigin = (): URL | undefined => {
  const baseUrl = process.env['BASE_URL'] ?? ''
  if (baseUrl === '') return undefined
  try {
    return new URL(baseUrl)
  } catch {
    return undefined
  }
}

/**
 * Build the passkey plugin when `auth.passkeys` is set; `[]` otherwise, so the
 * passkey endpoints answer 404.
 *
 * The relying party is derived from `BASE_URL`, never configured: its host is
 * the `rpID` and its origin the expected `origin`, because a passkey is bound
 * to the host it was created on. Without `BASE_URL` (a development machine)
 * the plugin falls back to the request's own `Origin` and to `localhost`.
 *
 * Passkeys are created as discoverable credentials (`residentKey: required`)
 * so that "Sign in with a passkey" needs no email first.
 */
export const buildPasskeyPlugin = (authConfig: Auth | undefined, appName: string | undefined) => {
  if (!authConfig?.passkeys) return []
  const config = typeof authConfig.passkeys === 'boolean' ? {} : authConfig.passkeys
  const base = baseUrlOrigin()
  const plugin = passkey({
    ...(base === undefined ? {} : { rpID: base.hostname, origin: base.origin }),
    ...((config.rpName ?? appName) ? { rpName: config.rpName ?? appName } : {}),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  })
  return [{ ...plugin, hooks: { before: [{ matcher: isVerification, handler: originFromHost }] } }]
}

const isVerification = (ctx: { readonly path?: string }): boolean =>
  ctx.path === '/passkey/verify-registration' || ctx.path === PASSKEY_SIGN_IN_PATH

/**
 * Without `BASE_URL`, the expected origin of a ceremony on a loopback request
 * is the request's own address (`loopbackRequestOrigin`). The browser's
 * `Origin` header cannot stand in: the security headers' referrer policy
 * withholds it from same-origin requests.
 */
const originFromHost = createAuthMiddleware(async (ctx) => {
  const origin = loopbackRequestOrigin(ctx.headers)
  return origin === undefined ? undefined : { context: { headers: new Headers({ origin }) } }
})
