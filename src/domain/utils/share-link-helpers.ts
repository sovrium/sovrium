/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { randomBytes } from 'node:crypto'
import { parseDuration } from '@/domain/utils/parse-duration'

/**
 * Token + password utilities for share-link creation and verification.
 *
 * Token: 24 random bytes encoded as base64url. That's 32 characters
 * after encoding (the spec contract requires min 32 chars). The
 * `crypto.randomBytes` source provides cryptographically random bytes;
 * the schema's UNIQUE index on `token` catches the astronomical-but-
 * non-zero collision case at insert time so callers can retry.
 *
 * Password hashing: Bun.password.hash defaults to argon2id, which is
 * stronger than bcrypt and the modern default. Verify uses
 * Bun.password.verify with the same algorithm. No third-party
 * dependency required.
 *
 * Expiry: parseDuration from plan 01a converts "30m"/"24h"/"7d"/"4w"
 * to milliseconds, then we add to now() for the absolute timestamp the
 * column expects.
 */

const base64url = (buffer: Buffer): string =>
  buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

export const generateShareToken = (): string => base64url(randomBytes(24))

export const hashSharePassword = async (plaintext: string): Promise<string> => {
  return Bun.password.hash(plaintext)
}

export const verifySharePassword = async (plaintext: string, hash: string): Promise<boolean> => {
  return Bun.password.verify(plaintext, hash)
}

/**
 * Resolve an expiry timestamp from a duration string (e.g., "7d") OR
 * an absolute ISO 8601 string. Returns undefined for missing input or
 * invalid format — callers treat undefined as "no expiry".
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Date is intrinsically mutable; Readonly<Date> buys nothing
export const resolveExpiryTimestamp = (input: unknown): Date | undefined => {
  if (typeof input !== 'string' || input === '') return undefined

  // Try ISO 8601 first (absolute timestamp).
  const asDate = new Date(input)
  if (!Number.isNaN(asDate.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(input)) {
    return asDate
  }

  // Otherwise treat as a duration string.
  const ms = parseDuration(input)
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  return new Date(Date.now() + ms)
}
