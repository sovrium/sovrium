/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/

/**
 * The origin a loopback request was sent to, read from its `Host` — only when
 * `BASE_URL` is unset, and only for a loopback host.
 *
 * Without `BASE_URL` the server knows the port it ASKED for (`PORT=0` on a
 * development or test machine, where the socket is bound afterwards), not the
 * one the browser is on. The single sign-on redirect URI and the passkey
 * origin both have to name the address the browser actually uses, and on a
 * loopback request that is its own `Host`. A configured `BASE_URL` always
 * wins, so a deployment never derives anything from a header.
 */
export const loopbackRequestOrigin = (headers: Headers | undefined): string | undefined => {
  if ((process.env['BASE_URL'] ?? '') !== '') return undefined
  const host = headers?.get('host') ?? ''
  return LOOPBACK_HOST.test(host) ? `http://${host}` : undefined
}
