/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const encoder = new TextEncoder()

const HASH_BY_ALGORITHM = {
  sha256: 'SHA-256',
  sha1: 'SHA-1',
} as const

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
  if (expected.length !== signature.length) return false
  const a = encoder.encode(expected)
  const b = encoder.encode(signature)
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!
  }
  return result === 0
}
