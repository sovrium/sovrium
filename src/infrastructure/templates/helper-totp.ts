/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toStr } from './helper-coercion'

/**
 * `{{totp $env.NAME}}` — the current one-time code (RFC 6238: HMAC-SHA-1,
 * 30-second steps, 6 digits) for the base32 secret in that variable, for a
 * browser step that signs in with a second factor.
 *
 * The code is computed when the template is rendered, and a browser step
 * renders its value only as it types it, so the code reaches the page and
 * nothing else: not the stored input, not the trace. An empty or malformed
 * secret renders as an empty string, which the site then refuses.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** RFC 4648 base32, spaces, dashes and padding ignored, any case. `undefined` when malformed. */
const base32Bytes = (secret: string): Uint8Array | undefined => {
  const clean = secret.replace(/[\s=-]/g, '').toUpperCase()
  if (clean === '' || [...clean].some((char) => !BASE32.includes(char))) return undefined
  const bits = [...clean].map((char) => BASE32.indexOf(char).toString(2).padStart(5, '0')).join('')
  const bytes = Array.from({ length: Math.floor(bits.length / 8) }, (_, i) =>
    parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  )
  return new Uint8Array(bytes)
}

/** The 6-digit code for `secret` at `unixSeconds`, or `''` for a malformed secret. */
export const totpAt = (secret: string, unixSeconds: number): string => {
  const key = base32Bytes(secret)
  if (key === undefined) return ''
  const counter = new Uint8Array(8)
  new DataView(counter.buffer).setBigUint64(0, BigInt(Math.floor(unixSeconds / 30)))
  const mac = new Bun.CryptoHasher('sha1', key).update(counter).digest()
  const offset = (mac[mac.length - 1] ?? 0) & 0x0f
  const binary = mac.readUInt32BE(offset) & 0x7f_ff_ff_ff
  return String(binary % 1_000_000).padStart(6, '0')
}

/** The `totp` helper: the code for the secret it is given, now. */
export const totpHelper = (secret: unknown): string => totpAt(toStr(secret), Date.now() / 1000)
