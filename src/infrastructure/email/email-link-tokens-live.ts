/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { Layer } from 'effect'
import {
  EmailLinkTokens,
  type UnsubscribeClaims,
} from '@/application/ports/services/email-link-tokens'
import { deriveSubkey } from '@/infrastructure/crypto/root-secret'

/** How long an unsubscribe link stays good. */
export const UNSUBSCRIBE_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000

/** Domain separation: these keys seal nothing else. */
const UNSUBSCRIBE_PURPOSE = 'sovrium-email-unsubscribe-v1'
const OPEN_PURPOSE = 'sovrium-email-open-v1'

const IV_BYTES = 12
const TAG_BYTES = 16

/**
 * Seal a text with AES-256-GCM: `base64url(iv | ciphertext | tag)`. Authenticated
 * encryption, so a token altered by one character opens to nothing, and the
 * recipient it names is never readable from the link.
 */
export const sealText = (key: Buffer, text: string): string => {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url')
}

/** Open a sealed text, or `undefined` when it was altered, forged or sealed with another key. */
export const openText = (key: Buffer, token: string): string | undefined => {
  try {
    const raw = Buffer.from(token, 'base64url')
    // Strict: a last character whose unused bits were changed decodes to the
    // same bytes, so a token is ours only if it re-encodes to itself.
    if (raw.length <= IV_BYTES + TAG_BYTES || raw.toString('base64url') !== token) return undefined
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES))
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES))
    const body = raw.subarray(IV_BYTES, raw.length - TAG_BYTES)
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
  } catch {
    // A failed authentication is the answer: the token is not ours.
    return undefined
  }
}

/** Parse opened unsubscribe claims, refusing an expired or malformed payload. */
export const parseUnsubscribeClaims = (
  text: string | undefined,
  now: number
): UnsubscribeClaims | undefined => {
  if (text === undefined) return undefined
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const { a, c, m, e } = parsed
    if (typeof a !== 'string' || typeof c !== 'string' || typeof m !== 'string') return undefined
    if (typeof e !== 'number' || e < now) return undefined
    return { address: a, category: c, ref: m }
  } catch {
    return undefined
  }
}

/** The tokens over two keys derived once from the root secret. */
export const makeEmailLinkTokens = (
  unsubscribeKey: Buffer,
  openKey: Buffer,
  clock: () => number = Date.now
): EmailLinkTokens['Service'] => ({
  sealUnsubscribe: ({ address, category, ref }) =>
    sealText(
      unsubscribeKey,
      JSON.stringify({
        a: address,
        c: category,
        m: ref,
        e: clock() + UNSUBSCRIBE_TOKEN_LIFETIME_MS,
      })
    ),
  openUnsubscribe: (token) => parseUnsubscribeClaims(openText(unsubscribeKey, token), clock()),
  sealOpen: (ref) => sealText(openKey, ref),
  openOpen: (token) => openText(openKey, token),
})

/** Live tokens; the keys are derived on first use, not at layer construction. */
export const EmailLinkTokensLive = Layer.sync(EmailLinkTokens, () => {
  const keys = {
    unsubscribe: undefined as Buffer | undefined,
    open: undefined as Buffer | undefined,
  }
  const unsubscribeKey = (): Buffer => (keys.unsubscribe ??= deriveSubkey(UNSUBSCRIBE_PURPOSE))
  const openKey = (): Buffer => (keys.open ??= deriveSubkey(OPEN_PURPOSE))
  return {
    sealUnsubscribe: (claims) =>
      makeEmailLinkTokens(unsubscribeKey(), openKey()).sealUnsubscribe(claims),
    openUnsubscribe: (token) =>
      makeEmailLinkTokens(unsubscribeKey(), openKey()).openUnsubscribe(token),
    sealOpen: (ref) => makeEmailLinkTokens(unsubscribeKey(), openKey()).sealOpen(ref),
    openOpen: (token) => makeEmailLinkTokens(unsubscribeKey(), openKey()).openOpen(token),
  }
})
