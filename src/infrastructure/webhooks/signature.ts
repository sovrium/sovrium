/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * HMAC webhook signature generation and verification.
 *
 * Uses Web Crypto API (available in Bun natively). This module is the single
 * source of HMAC primitives for both the legacy automation-webhook signature
 * (`generateSignature`/`verifySignature`) and per-table webhook auth headers
 * (`computeHmacSignature`).
 */

const encoder = new TextEncoder()

/** Web Crypto hash names keyed by the algorithm tokens Sovrium accepts. */
const HASH_BY_ALGORITHM = {
  sha256: 'SHA-256',
  sha1: 'SHA-1',
} as const

/** Algorithm tokens accepted by {@link computeHmacSignature}. */
export type HmacAlgorithm = keyof typeof HASH_BY_ALGORITHM

const getKey = async (secret: string, algorithm: HmacAlgorithm = 'sha256'): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: HASH_BY_ALGORITHM[algorithm] },
    false,
    ['sign', 'verify']
  )

const bufferToHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * Compute an `<algorithm>=<hex>` HMAC signature of `payload`. The algorithm
 * prefix mirrors the GitHub webhook convention so receivers can parse the
 * algorithm from the header value itself.
 *
 * @public
 */
export const computeHmacSignature = async (
  payload: string,
  secret: string,
  algorithm: HmacAlgorithm = 'sha256'
): Promise<string> => {
  const key = await getKey(secret, algorithm)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `${algorithm}=${bufferToHex(signature)}`
}

export const generateSignature = async (payload: string, secret: string): Promise<string> =>
  computeHmacSignature(payload, secret, 'sha256')

export const verifySignature = async (
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> => {
  const expected = await generateSignature(payload, secret)
  // Timing-safe comparison
  if (expected.length !== signature.length) return false
  const a = encoder.encode(expected)
  const b = encoder.encode(signature)
  // eslint-disable-next-line functional/no-let
  let result = 0
  // eslint-disable-next-line functional/no-loop-statements
  for (let i = 0; i < a.length; i++) {
    // eslint-disable-next-line functional/no-expression-statements
    result |= a[i]! ^ b[i]!
  }
  return result === 0
}
