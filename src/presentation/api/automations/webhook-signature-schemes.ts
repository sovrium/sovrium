/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signature schemes of an incoming `hmac` webhook beyond the default hex
 * digest: `base64` (Shopify) and the three timestamped provider formats —
 * Stripe (`t=,v1=`), Slack (`v0:`) and Svix (`svix-id`, `svix-timestamp`,
 * `svix-signature`). Each is verified over the RAW body exactly as the
 * provider signs it, compared in constant time, and the timestamped ones
 * refuse a signed timestamp further than `tolerance` seconds from the server
 * clock, which is what stops a captured request being replayed.
 */

/** Default replay window, in seconds — the providers' own recommendation. */
export const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300

type HeaderReader = (name: string) => string | undefined

interface TimestampedInput {
  readonly header: HeaderReader
  readonly rawBody: string
  readonly secret: string
  readonly toleranceSeconds: number
  readonly nowSeconds: number
}

/**
 * Constant-time equality that also hides the expected length: both sides are
 * hashed first, so the compared buffers always have the same size.
 */
const safeEqual = (supplied: string, expected: string): boolean =>
  timingSafeEqual(
    createHash('sha256').update(supplied).digest(),
    createHash('sha256').update(expected).digest()
  ) && supplied.length === expected.length

const anyMatches = (candidates: readonly string[], expected: string): boolean =>
  // Every candidate is compared, so the position of the matching one leaks nothing.
  candidates.map((candidate) => safeEqual(candidate, expected)).includes(true)

const hmacSha256 = (key: string | Buffer, payload: string, encoding: 'hex' | 'base64'): string =>
  createHmac('sha256', key).update(payload).digest(encoding)

const withinTolerance = (
  timestamp: string | undefined,
  nowSeconds: number,
  toleranceSeconds: number
): boolean => {
  if (timestamp === undefined || !/^\d+$/.test(timestamp)) return false
  return Math.abs(nowSeconds - Number(timestamp)) <= toleranceSeconds
}

/** Stripe: `Stripe-Signature: t=<t>,v1=<hex>[,v1=<hex>…]` over `<t>.<body>`. */
const verifyStripe = (input: TimestampedInput): boolean => {
  const entries = (input.header('Stripe-Signature') ?? '')
    .split(',')
    .map((part) => part.trim().split('='))
    .filter((pair): pair is [string, string] => pair.length === 2)
  const timestamp = entries.find(([name]) => name === 't')?.[1]
  const signatures = entries.filter(([name]) => name === 'v1').map(([, value]) => value)
  if (!withinTolerance(timestamp, input.nowSeconds, input.toleranceSeconds)) return false
  if (signatures.length === 0) return false
  return anyMatches(signatures, hmacSha256(input.secret, `${timestamp}.${input.rawBody}`, 'hex'))
}

/** Slack: `X-Slack-Signature: v0=<hex>` over `v0:<timestamp>:<body>`. */
const verifySlack = (input: TimestampedInput): boolean => {
  const timestamp = input.header('X-Slack-Request-Timestamp')
  const supplied = input.header('X-Slack-Signature') ?? ''
  if (!withinTolerance(timestamp, input.nowSeconds, input.toleranceSeconds)) return false
  if (supplied === '') return false
  const expected = `v0=${hmacSha256(input.secret, `v0:${timestamp}:${input.rawBody}`, 'hex')}`
  return safeEqual(supplied, expected)
}

/** The Svix signing key: the part after `whsec_`, base64-decoded. */
const svixKey = (secret: string): Buffer =>
  Buffer.from(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret, 'base64')

/** Svix: `svix-signature: v1,<base64> [v1,<base64>…]` over `<id>.<timestamp>.<body>`. */
const verifySvix = (input: TimestampedInput): boolean => {
  const id = input.header('svix-id')
  const timestamp = input.header('svix-timestamp')
  if (id === undefined || id === '') return false
  if (!withinTolerance(timestamp, input.nowSeconds, input.toleranceSeconds)) return false
  const signatures = (input.header('svix-signature') ?? '')
    .split(' ')
    .map((entry) => entry.split(','))
    .filter((pair): pair is [string, string] => pair.length === 2 && pair[0] === 'v1')
    .map(([, value]) => value)
  if (signatures.length === 0) return false
  const key = svixKey(input.secret)
  if (key.length === 0) return false
  return anyMatches(signatures, hmacSha256(key, `${id}.${timestamp}.${input.rawBody}`, 'base64'))
}

/** Verify one of the timestamped schemes. */
export const verifyTimestampedSignature = (
  scheme: 'stripe' | 'slack' | 'svix',
  input: TimestampedInput
): boolean => {
  if (scheme === 'stripe') return verifyStripe(input)
  if (scheme === 'slack') return verifySlack(input)
  return verifySvix(input)
}

/** Verify a digest of the raw body read from one header, after an optional prefix. */
export const verifyRawBodyDigest = (input: {
  readonly supplied: string
  readonly rawBody: string
  readonly secret: string
  readonly algorithm: string
  readonly encoding: 'hex' | 'base64'
  readonly prefix: string
}): boolean => {
  if (input.supplied === '') return false
  const computed = createHmac(input.algorithm, input.secret)
    .update(input.rawBody)
    .digest(input.encoding)
  return safeEqual(input.supplied, `${input.prefix}${computed}`)
}
