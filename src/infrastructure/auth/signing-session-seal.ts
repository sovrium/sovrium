/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto'
import { resolveAuthSecret } from './auth-secret'

/**
 * The value a signing page's cookie holds: the signer the session is for and
 * when it ends, sealed with a key only this server holds.
 *
 * `<signerId>.<expiresAtEpochSeconds>.<mac>`, the mac an HMAC (SHA 256) of the
 * first two parts, base64url. It names a signer, never her link token, so a
 * cookie read from a browser or a log cannot open a link; and it carries its
 * own end, so it needs no table. It is not a credential on its own either:
 * every road that reads it re-reads the request and the signer, so a request
 * withdrawn or expired answers the uniform not-found whatever the cookie says.
 *
 * The key is derived (HKDF over SHA 256, its own `info` label) from the server's
 * auth secret, so a value sealed for this purpose verifies for no other, and a
 * rotated auth secret ends every open signing session with the rest.
 */

/** The HKDF label of the sealing key. Changing it ends every open signing session. */
const KEY_INFO = 'sovrium-signing-session-v1'

/** The sealing key, derived once per auth secret. */
const keyCache = new Map<string, Buffer>()

const sealingKey = (): Buffer => {
  const secret = resolveAuthSecret()
  const cached = keyCache.get(secret)
  if (cached !== undefined) return cached
  const key = Buffer.from(hkdfSync('sha256', secret, '', KEY_INFO, 32))
  keyCache.clear()
  keyCache.set(secret, key)
  return key
}

const macOf = (payload: string): Buffer =>
  createHmac('sha256', sealingKey()).update(payload).digest()

/** The sealed value naming `signerId` until `expiresAtMs`. */
export const sealSigningSession = (signerId: string, expiresAtMs: number): string => {
  const payload = `${signerId}.${String(Math.floor(expiresAtMs / 1000))}`
  return `${payload}.${macOf(payload).toString('base64url')}`
}

/** Whether `mac` (base64url) is the seal of `payload`, compared in constant time. */
const sealMatches = (payload: string, mac: string): boolean => {
  const given = Buffer.from(mac, 'base64url')
  const expected = macOf(payload)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** The signer a sealed value names while it has not ended at `nowMs`; `undefined` otherwise. */
export const openSigningSessionSeal = (
  sealed: string | undefined,
  nowMs: number
): string | undefined => {
  const parts = (sealed ?? '').split('.')
  if (parts.length !== 3) return undefined
  const [signerId = '', expires = '', mac = ''] = parts
  if (signerId === '' || !sealMatches(`${signerId}.${expires}`, mac)) return undefined
  return Number(expires) * 1000 > nowMs ? signerId : undefined
}
